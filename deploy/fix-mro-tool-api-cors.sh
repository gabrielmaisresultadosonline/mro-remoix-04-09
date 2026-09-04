#!/usr/bin/env bash
# Corrige e comprova o CORS da mro-tool-api em todas as camadas da VPS:
# código Deno -> host Express -> Nginx -> domínio público.
#
# Não altera server/.env, banco, uploads, tokens, credenciais ou certificados.
# Uso (na raiz do projeto):
#   sudo bash deploy/fix-mro-tool-api-cors.sh
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/ia-mro}"
API_DOMAIN="${API_DOMAIN:-api.maisresultadosonline.com.br}"
BACKEND_PORT="${BACKEND_PORT:-8787}"
SITE_ORIGIN="${SITE_ORIGIN:-https://maisresultadosonline.com.br}"
FUNCTION_PATH="/functions/v1/mro-tool-api"
CANONICAL_REPO_URL="https://github.com/gabrielmaisresultadosonline/mro-remoix-04-09.git"
LOG_FILE="${LOG_FILE:-/var/log/mro/mro-tool-cors-check.log}"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$(id -u)" == "0" ]] || die "Rode como root: sudo bash deploy/fix-mro-tool-api-cors.sh"
[[ -d "$PROJECT_DIR/.git" ]] || die "Projeto Git não encontrado em $PROJECT_DIR."
for binary in git curl nginx python3 pm2; do
  command -v "$binary" >/dev/null 2>&1 || die "$binary não encontrado na VPS."
done

cd "$PROJECT_DIR"
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1
printf '\n===== Verificação CORS mro-tool-api: %s =====\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Log persistente: $LOG_FILE"

log "1/6 Sincronizando o repositório oficial"
CURRENT_REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$CURRENT_REMOTE" != "$CANONICAL_REPO_URL" ]]; then
  warn "origin anterior: ${CURRENT_REMOTE:-não configurado}"
  if [[ -n "$CURRENT_REMOTE" ]]; then
    git remote set-url origin "$CANONICAL_REPO_URL"
  else
    git remote add origin "$CANONICAL_REPO_URL"
  fi
fi
git fetch --prune --force origin main
git checkout -B main origin/main --quiet
git reset --hard origin/main --quiet
ok "Código oficial em $(git rev-parse --short HEAD)"

log "2/6 Confirmando CORS dentro da Edge Function"
FUNCTION_FILE="supabase/functions/mro-tool-api/index.ts"
[[ -f "$FUNCTION_FILE" ]] || die "$FUNCTION_FILE não existe nesta revisão."
grep -q 'Access-Control-Allow-Origin' "$FUNCTION_FILE" || die "Allow-Origin ausente da função."
grep -q 'Access-Control-Allow-Methods' "$FUNCTION_FILE" || die "Allow-Methods ausente da função."
grep -q 'Access-Control-Allow-Headers' "$FUNCTION_FILE" || die "Allow-Headers ausente da função."
grep -q 'req.method === "OPTIONS"' "$FUNCTION_FILE" || die "Handler OPTIONS ausente da função."
grep -q 'headers: { ...corsHeaders' "$FUNCTION_FILE" || die "Helper de respostas com CORS ausente."
grep -q '\[MRO-TOOL-CORS\] OPTIONS liberado' "$FUNCTION_FILE" || die "Log de preflight ausente da função."
grep -q '\[MRO-CORS\] OPTIONS liberado' server/src/index.ts || die "Preflight imediato ausente do host Express."
ok "OPTIONS e respostas JSON da função incluem CORS."

log "3/6 Executando deploy completo preservando dados e credenciais"
chmod +x deploy.sh
env -u REPO_URL ./deploy.sh --cutover
ok "Build, banco, frontend, backend e funções atualizados."

log "4/6 Conferindo o proxy correto do Nginx"
NGINX_DUMP="$(mktemp)"
trap 'rm -f "$NGINX_DUMP"' EXIT
nginx -T >"$NGINX_DUMP" 2>&1 || die "nginx -T falhou."
python3 - "$NGINX_DUMP" "$API_DOMAIN" "$BACKEND_PORT" <<'PY'
import re, sys

text = open(sys.argv[1], encoding="utf-8").read()
domain, port = sys.argv[2], sys.argv[3]

def blocks(source, header):
    found = []
    for match in re.finditer(header, source, flags=re.M):
        opening = source.find("{", match.start())
        if opening < 0:
            continue
        depth = 0
        for index in range(opening, len(source)):
            if source[index] == "{":
                depth += 1
            elif source[index] == "}":
                depth -= 1
                if depth == 0:
                    found.append(source[match.start():index + 1])
                    break
    return found

servers = blocks(text, r"^\s*server\s*\{")
server = next((block for block in servers if re.search(r"server_name[^;]*\b" + re.escape(domain) + r"\b", block)), "")
if not server:
    raise SystemExit("vhost da API não encontrado no nginx -T")
locations = blocks(server, r"^\s*location\s+/functions/v1/?\s*\{")
if not locations:
    raise SystemExit("location /functions/v1/ ausente do vhost")
block = locations[0]
if not re.search(r"proxy_pass\s+http://127\.0\.0\.1:" + re.escape(port) + r"\s*;", block):
    raise SystemExit("/functions/v1/ não aponta para o backend Express em 127.0.0.1:" + port)
if re.search(r"add_header\s+['\"]?Access-Control-", block, flags=re.I):
    raise SystemExit("CORS duplicado no Nginx; os headers devem vir do backend/função")
PY
ok "Nginx encaminha funções ao Express em 127.0.0.1:${BACKEND_PORT}, sem CORS duplicado."

log "5/6 Reiniciando o runtime e aguardando saúde"
pm2 restart mro-api --update-env >/dev/null || die "PM2 não conseguiu reiniciar mro-api."
READY=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null; then
    READY=true
    break
  fi
  sleep 1
done
[[ "$READY" == "true" ]] || {
  pm2 describe mro-api || true
  tail -n 120 /var/log/mro/api-error.log 2>/dev/null || true
  die "Backend não ficou saudável após o reinício."
}
ok "Backend saudável."

check_cors() {
  local label="$1" url="$2" method="$3" expected_status="$4" request_origin="$5"
  local request_headers="authorization,apikey,content-type,x-client-info,x-supabase-client-platform"
  local headers body status count origin methods allowed missing_header
  headers="$(mktemp)"; body="$(mktemp)"

  if [[ "$method" == "OPTIONS" ]]; then
    status="$(curl -sS --max-time 75 -D "$headers" -o "$body" -w '%{http_code}' -X OPTIONS \
      -H "Origin: $request_origin" \
      -H 'Access-Control-Request-Method: POST' \
      -H "Access-Control-Request-Headers: $request_headers" \
      "$url" || true)"
  else
    status="$(curl -sS --max-time 75 -D "$headers" -o "$body" -w '%{http_code}' -X POST \
      -H "Origin: $request_origin" \
      -H 'Content-Type: application/json' \
      --data '{"action":"verify_user","username":"__cors_healthcheck__"}' \
      "$url" || true)"
  fi

  count="$(grep -ci '^access-control-allow-origin:' "$headers" || true)"
  origin="$(grep -i '^access-control-allow-origin:' "$headers" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
  methods="$(grep -i '^access-control-allow-methods:' "$headers" | head -1 | tr -d '\r' || true)"
  allowed="$(grep -i '^access-control-allow-headers:' "$headers" | head -1 | tr -d '\r' || true)"
  printf '  %-26s HTTP %-3s origin=%-38s CORS=%s\n' "$label" "${status:-000}" "$request_origin" "${origin:-ausente}"
  echo "    allow-methods: ${methods:-ausente}"
  echo "    allow-headers: ${allowed:-ausente}"

  if [[ "$status" != "$expected_status" || "$count" != "1" || ( "$origin" != "*" && "$origin" != "$SITE_ORIGIN" ) ]]; then
    echo "  allow-methods: ${methods:-ausente}"
    echo "  allow-headers: ${allowed:-ausente}"
    head -c 1500 "$body" 2>/dev/null || true; echo
    rm -f "$headers" "$body"
    return 1
  fi
  if [[ "$method" == "OPTIONS" ]]; then
    [[ "$methods" == *"POST"* ]] || { rm -f "$headers" "$body"; return 1; }
    for missing_header in authorization apikey content-type x-client-info x-supabase-client-platform; do
      if [[ "${allowed,,}" != *"$missing_header"* ]]; then
        echo "    FALHA: header solicitado não foi liberado: $missing_header"
        rm -f "$headers" "$body"
        return 1
      fi
    done
  fi
  rm -f "$headers" "$body"
}

log "6/6 Testando preflight e POST, local e público"
FAILED=0
for TEST_ORIGIN in "$SITE_ORIGIN" "chrome-extension://mro-ferramenta" "https://www.instagram.com"; do
  check_cors "OPTIONS local" "http://127.0.0.1:${BACKEND_PORT}${FUNCTION_PATH}" OPTIONS 204 "$TEST_ORIGIN" || FAILED=1
  check_cors "OPTIONS público" "https://${API_DOMAIN}${FUNCTION_PATH}" OPTIONS 204 "$TEST_ORIGIN" || FAILED=1
done
check_cors "POST local" "http://127.0.0.1:${BACKEND_PORT}${FUNCTION_PATH}" POST 200 "chrome-extension://mro-ferramenta" || FAILED=1
check_cors "POST público" "https://${API_DOMAIN}${FUNCTION_PATH}" POST 200 "chrome-extension://mro-ferramenta" || FAILED=1

if [[ "$FAILED" != "0" ]]; then
  echo
  warn "Diagnóstico automático (sem exibir segredos):"
  pm2 describe mro-api 2>/dev/null | grep -E 'status|script path|exec cwd|restarts|uptime' || true
  tail -n 150 /var/log/mro/api-out.log 2>/dev/null || true
  tail -n 150 /var/log/mro/api-error.log 2>/dev/null || true
  nginx -T 2>/dev/null | grep -nE "server_name .*${API_DOMAIN}|location /functions/v1|proxy_pass http://127.0.0.1" | tail -n 40 || true
  die "CORS ainda inválido em alguma camada; os logs acima identificam onde parou."
fi

ok "CORS da mro-tool-api validado de ponta a ponta."
echo
echo "CONCLUÍDO: extensão -> domínio -> Nginx -> Express -> Deno funcionando sem proxy público."
echo "Para acompanhar preflights reais: pm2 logs mro-api --lines 100 | grep --line-buffered 'MRO-CORS'"
echo "Relatório desta execução: $LOG_FILE"