#!/usr/bin/env bash
# Instala uma rota CORS exclusiva e permanente para a mro-tool-api.
# O Nginx responde OPTIONS sem depender do Express/Deno e acrescenta os
# cabeçalhos também em erros 4xx/5xx. O proxy oculta os headers da função para
# garantir exatamente um Access-Control-Allow-Origin na resposta final.
set -euo pipefail

API_DOMAIN="${API_DOMAIN:-api.maisresultadosonline.com.br}"
BACKEND_PORT="${BACKEND_PORT:-8787}"

command -v nginx >/dev/null 2>&1 || { echo "ERRO: nginx não encontrado." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERRO: python3 não encontrado." >&2; exit 1; }

CONFIG_FILE="$(grep -RlE --include='*.conf' --include='*mro*' --include='*api*' \
  "server_name.*${API_DOMAIN//./\\.}" /etc/nginx 2>/dev/null \
  | grep -vE '\.(pre-media-hotfix|pre-mro-cors|bak|backup|disabled)$' | head -1 || true)"

[[ -n "$CONFIG_FILE" ]] || { echo "ERRO: vhost de $API_DOMAIN não encontrado." >&2; exit 1; }

python3 - "$CONFIG_FILE" "$API_DOMAIN" "$BACKEND_PORT" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
domain = sys.argv[2]
port = sys.argv[3]
text = path.read_text(encoding="utf-8")

start_marker = "# MRO-TOOL-CORS-BEGIN"
end_marker = "# MRO-TOOL-CORS-END"
text = re.sub(
    rf"(?ms)^\s*{re.escape(start_marker)}.*?^\s*{re.escape(end_marker)}\s*\n?",
    "",
    text,
)

block = f'''    {start_marker}
    # Rota pública usada por extensões externas. Não usa cookies.
    location = /functions/v1/mro-tool-api {{
        if ($request_method = OPTIONS) {{
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "authorization, apikey, content-type, x-client-info, x-requested-with, accept, accept-profile, content-profile, prefer, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" always;
            add_header Access-Control-Max-Age "86400" always;
            add_header Cache-Control "no-store" always;
            return 204;
        }}

        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Access-Control-Allow-Methods;
        proxy_hide_header Access-Control-Allow-Headers;
        proxy_hide_header Access-Control-Expose-Headers;
        proxy_hide_header Access-Control-Max-Age;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "authorization, apikey, content-type, x-client-info, x-requested-with, accept, accept-profile, content-profile, prefer, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" always;
        add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Content-Type" always;
        add_header Access-Control-Max-Age "86400" always;
        add_header X-Cors-Owner "nginx-mro-tool" always;

        proxy_pass http://127.0.0.1:{port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }}
    {end_marker}
'''

server_pattern = re.compile(r"(?m)^\s*server\s*\{")
insertions = []
for server_match in server_pattern.finditer(text):
    opening = text.find("{", server_match.start())
    depth = 0
    closing = -1
    for index in range(opening, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                closing = index
                break
    if closing < 0:
        continue
    server = text[server_match.start():closing + 1]
    if not re.search(r"server_name[^;]*\b" + re.escape(domain) + r"\b", server):
        continue
    insertions.append(server_match.start() + server.find("\n") + 1)

if not insertions:
    raise SystemExit(f"vhost de {domain} não encontrado em {path}")

# Certbot normalmente mantém um bloco HTTP e outro HTTPS para o mesmo domínio.
# Instalar em todos evita corrigir apenas o redirecionamento da porta 80.
for insertion in reversed(insertions):
    text = text[:insertion] + block + "\n" + text[insertion:]

backup = path.with_suffix(path.suffix + ".pre-mro-cors")
if not backup.exists():
    backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
path.write_text(text, encoding="utf-8")
PY

nginx -t
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx
else
  nginx -s reload
fi

check_url() {
  local label="$1" url="$2" headers status count origin allowed methods owner
  headers="$(mktemp)"
  status="$(curl -sS --max-time 20 -X OPTIONS -o /dev/null -D "$headers" -w '%{http_code}' \
    -H 'Origin: chrome-extension://mro-ferramenta' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: authorization,apikey,content-type,x-client-info,x-supabase-client-platform' \
    "$url" || true)"
  count="$(grep -ci '^access-control-allow-origin:' "$headers" || true)"
  origin="$(grep -i '^access-control-allow-origin:' "$headers" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
  allowed="$(grep -i '^access-control-allow-headers:' "$headers" | head -1 | tr '[:upper:]' '[:lower:]' || true)"
  methods="$(grep -i '^access-control-allow-methods:' "$headers" | head -1 | tr '[:lower:]' '[:upper:]' || true)"
  owner="$(grep -i '^x-cors-owner:' "$headers" | head -1 | tr -d '\r' || true)"
  if [[ "$status" != "204" || "$count" != "1" || "$origin" != "*" \
      || "$methods" != *"POST"* || "$allowed" != *"authorization"* \
      || "$allowed" != *"apikey"* || "$allowed" != *"content-type"* \
      || "$allowed" != *"x-client-info"* || "$allowed" != *"x-supabase-client-platform"* ]]; then
    echo "ERRO: $label inválido: HTTP=${status:-000}, allow-origin=${origin:-ausente}, quantidade=$count" >&2
    cat "$headers" >&2
    rm -f "$headers"
    return 1
  fi
  echo "OK: $label liberado (HTTP 204, origem *, um único header; ${owner:-rota local})."
  rm -f "$headers"
}

echo "Aguardando backend na porta ${BACKEND_PORT}..."
for i in {1..30}; do
  if curl -s "http://127.0.0.1:${BACKEND_PORT}/health" > /dev/null; then
    echo "Backend pronto."
    break
  fi
  sleep 1
done

check_url "CORS local" "http://127.0.0.1:${BACKEND_PORT}/functions/v1/mro-tool-api"
check_url "CORS público" "https://${API_DOMAIN}/functions/v1/mro-tool-api"

echo "CORS permanente da mro-tool-api instalado e comprovado."