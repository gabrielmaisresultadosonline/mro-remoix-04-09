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

mapfile -t ACTIVE_CONFIG_FILES < <(
  nginx -T 2>&1 \
    | sed -n 's|^# configuration file \([^:][^:]*\):$|\1|p' \
    | awk '!seen[$0]++'
)

[[ "${#ACTIVE_CONFIG_FILES[@]}" -gt 0 ]] || {
  echo "ERRO: nginx -T não informou os arquivos de configuração ativos." >&2
  exit 1
}

# Não use grep em /etc/nginx para escolher apenas o primeiro resultado: arquivos
# em sites-available, backups e vhosts antigos podem existir no disco sem serem
# carregados. nginx -T é a fonte de verdade sobre a configuração em execução.
python3 - "$API_DOMAIN" "$BACKEND_PORT" "${ACTIVE_CONFIG_FILES[@]}" <<'PY'
import pathlib
import re
import sys

domain = sys.argv[1]
port = sys.argv[2]
config_paths = [pathlib.Path(value) for value in sys.argv[3:]]

start_marker = "# MRO-TOOL-CORS-BEGIN"
end_marker = "# MRO-TOOL-CORS-END"

block = f'''    {start_marker}
    # Rota pública usada por extensões externas. Não usa cookies.
    # Prefixo deliberado: cobre URL exata, barra final e parâmetros/caminhos
    # acrescentados por versões antigas da extensão.
    location ^~ /functions/v1/mro-tool-api {{
        if ($request_method = OPTIONS) {{
            # Reflete a origem para aceitar também XMLHttpRequest/fetch com
            # credentials=include. Wildcard é rejeitado pelo navegador nesse modo.
            add_header Access-Control-Allow-Origin "$http_origin" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
            # Reflete todos os headers pedidos pela extensão. Assim versões novas
            # não voltam a falhar por acrescentarem um header próprio.
            add_header Access-Control-Allow-Headers "$http_access_control_request_headers" always;
            add_header Access-Control-Max-Age "86400" always;
            add_header Access-Control-Allow-Private-Network "true" always;
            add_header Cross-Origin-Resource-Policy "cross-origin" always;
            add_header Cache-Control "no-store" always;
            return 204;
        }}

        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Access-Control-Allow-Credentials;
        proxy_hide_header Access-Control-Allow-Methods;
        proxy_hide_header Access-Control-Allow-Headers;
        proxy_hide_header Access-Control-Expose-Headers;
        proxy_hide_header Access-Control-Max-Age;
        add_header Access-Control-Allow-Origin "$http_origin" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "$http_access_control_request_headers" always;
        add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Content-Type, X-MRO-Request-Id, X-MRO-Handler" always;
        add_header Access-Control-Max-Age "86400" always;
        add_header Access-Control-Allow-Private-Network "true" always;
        add_header Cross-Origin-Resource-Policy "cross-origin" always;
        add_header Cache-Control "no-store" always;
        add_header Vary "Origin, Access-Control-Request-Headers" always;
        add_header X-Cors-Owner "nginx-mro-tool" always;

        access_log /var/log/nginx/mro-tool-access.log combined;

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
patched = []

for path in config_paths:
    if not path.is_file():
        continue
    original = path.read_text(encoding="utf-8")
    text = re.sub(
        rf"(?ms)^\s*{re.escape(start_marker)}.*?^\s*{re.escape(end_marker)}\s*\n?",
        "",
        original,
    )
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
        continue

    # Certbot pode manter blocos HTTP e HTTPS em um ou mais includes ativos.
    for insertion in reversed(insertions):
        text = text[:insertion] + block + "\n" + text[insertion:]

    backup = path.with_suffix(path.suffix + ".pre-mro-cors")
    if not backup.exists():
        backup.write_text(original, encoding="utf-8")
    path.write_text(text, encoding="utf-8")
    patched.append(str(path))

if not patched:
    raise SystemExit(f"vhost ativo de {domain} não encontrado nos arquivos de nginx -T")

print("Configurações ativas corrigidas:")
for value in patched:
    print(f"  - {value}")
PY

nginx -t
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx
else
  nginx -s reload
fi

check_url() {
  local label="$1" url="$2" headers status count origin credentials allowed methods owner
  headers="$(mktemp)"
  status="$(curl -sS --max-time 20 -X OPTIONS -o /dev/null -D "$headers" -w '%{http_code}' \
    -H 'Origin: chrome-extension://mro-ferramenta' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: authorization,apikey,content-type,x-client-info,x-supabase-client-platform' \
    "$url" || true)"
  count="$(grep -ci '^access-control-allow-origin:' "$headers" || true)"
  origin="$(grep -i '^access-control-allow-origin:' "$headers" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
  credentials="$(grep -i '^access-control-allow-credentials:' "$headers" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
  allowed="$(grep -i '^access-control-allow-headers:' "$headers" | head -1 | tr '[:upper:]' '[:lower:]' || true)"
  methods="$(grep -i '^access-control-allow-methods:' "$headers" | head -1 | tr '[:lower:]' '[:upper:]' || true)"
  owner="$(grep -i '^x-cors-owner:' "$headers" | head -1 | tr -d '\r' || true)"
  if [[ "$status" != "204" || "$count" != "1" || "$origin" != "chrome-extension://mro-ferramenta" \
      || "$credentials" != "true" \
      || "$methods" != *"POST"* || "$allowed" != *"authorization"* \
      || "$allowed" != *"apikey"* || "$allowed" != *"content-type"* \
      || "$allowed" != *"x-client-info"* || "$allowed" != *"x-supabase-client-platform"* ]]; then
    echo "ERRO: $label inválido: HTTP=${status:-000}, allow-origin=${origin:-ausente}, quantidade=$count" >&2
    cat "$headers" >&2
    rm -f "$headers"
    return 1
  fi
  echo "OK: $label liberado (HTTP 204, origem refletida, credenciais aceitas; ${owner:-rota local})."
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

# O preflight público é responsabilidade do Nginx e deve funcionar mesmo durante
# o reinício do backend. Testamos essa garantia antes de depender da porta 8787.
check_url "CORS público" "https://${API_DOMAIN}/functions/v1/mro-tool-api"

# Valida o Nginx da própria VPS, não apenas o Express na porta 8787. Isso separa
# erro de vhost/precedência de qualquer transformação feita pelo Cloudflare.
check_url "CORS no Nginx local" "http://127.0.0.1/functions/v1/mro-tool-api" \
  -H "Host: ${API_DOMAIN}"

# POSTs reais ainda dependem do backend. startOrReload retorna antes de o Node
# terminar a inicialização, portanto aguarde a saúde em vez de tratar um
# connection refused transitório como falha de CORS.
BACKEND_READY=false
for attempt in $(seq 1 90); do
  if health="$(curl -sf --max-time 3 "http://127.0.0.1:${BACKEND_PORT}/health" 2>/dev/null)" \
      && printf '%s' "$health" | grep -q '"ok":true'; then
    BACKEND_READY=true
    break
  fi
  if [[ "$attempt" == "1" ]]; then
    echo "Aguardando a API iniciar na porta ${BACKEND_PORT}..."
  fi
  sleep 1
done

if [[ "$BACKEND_READY" != "true" ]]; then
  echo "ERRO: a API não ficou saudável na porta ${BACKEND_PORT}; o CORS público do Nginx está ativo, mas requisições POST não podem ser atendidas." >&2
  if command -v pm2 >/dev/null 2>&1; then
    pm2 describe mro-api 2>/dev/null | grep -E 'status|script path|exec cwd|restarts|uptime' >&2 || true
  fi
  tail -n 120 /var/log/mro/api-out.log 2>/dev/null >&2 || true
  tail -n 120 /var/log/mro/api-error.log 2>/dev/null >&2 || true
  exit 1
fi

check_url "CORS local" "http://127.0.0.1:${BACKEND_PORT}/functions/v1/mro-tool-api"

# Repete o contrato original da extensão: JSON + headers de autenticação.
# Credenciais deliberadamente inválidas devem retornar JSON pelo handler nativo,
# sem iniciar uma função Deno nem depender de uma porta interna adicional.
DIRECT_HEADERS="$(mktemp)"
DIRECT_STARTED="$(date +%s)"
DIRECT_BODY="$(curl -sS --max-time 15 -X POST -D "$DIRECT_HEADERS" \
  -H 'Origin: https://www.instagram.com' \
  -H 'Content-Type: application/json' \
  -H 'apikey: diagnostic-probe' \
  -H 'Authorization: Bearer diagnostic-probe' \
  --data-binary '{"action":"login","username":"__mro_cors_probe__","password":"__invalid__"}' \
  "https://${API_DOMAIN}/functions/v1/mro-tool-api" || true)"
DIRECT_DURATION="$(( $(date +%s) - DIRECT_STARTED ))"
DIRECT_ORIGIN="$(grep -i '^access-control-allow-origin:' "$DIRECT_HEADERS" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
DIRECT_CREDENTIALS="$(grep -i '^access-control-allow-credentials:' "$DIRECT_HEADERS" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
DIRECT_STATUS="$(head -1 "$DIRECT_HEADERS" | awk '{print $2}' || true)"
rm -f "$DIRECT_HEADERS"
if [[ "$DIRECT_STATUS" != "200" || "$DIRECT_ORIGIN" != "https://www.instagram.com" || "$DIRECT_CREDENTIALS" != "true" ]] \
    || ! printf '%s' "$DIRECT_BODY" | grep -q '"success":false'; then
  echo "ERRO: o POST real da extensão não retornou HTTP 200, JSON e CORS válidos." >&2
  exit 1
fi
echo "OK: login no contrato original respondeu pelo servidor em ${DIRECT_DURATION}s, com JSON e CORS."

echo "CORS permanente da mro-tool-api instalado e comprovado."