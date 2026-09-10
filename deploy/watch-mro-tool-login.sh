#!/usr/bin/env bash
# Diagnóstico ao vivo do login da extensão, sem imprimir senha, token ou corpo.
# Uso: sudo bash deploy/watch-mro-tool-login.sh
set -euo pipefail

API_DOMAIN="${API_DOMAIN:-api.maisresultadosonline.com.br}"
BACKEND_PORT="${BACKEND_PORT:-8787}"
API_OUT="${API_OUT:-/var/log/mro/api-out.log}"
API_ERROR="${API_ERROR:-/var/log/mro/api-error.log}"
NGINX_ACCESS="${NGINX_ACCESS:-/var/log/nginx/mro-tool-access.log}"
NGINX_ERROR="${NGINX_ERROR:-/var/log/nginx/error.log}"

[[ "$(id -u)" == "0" ]] || { echo "Rode como root: sudo bash deploy/watch-mro-tool-login.sh" >&2; exit 1; }

echo "===== Diagnóstico MRO Tool Login $(date -u '+%Y-%m-%dT%H:%M:%SZ') ====="
echo "Nenhuma senha, token ou corpo de requisição será exibido."
echo

echo "[1/4] Serviço e porta"
pm2 describe mro-api 2>/dev/null | grep -E 'status|script path|exec cwd|restarts|uptime' || true
ss -lntp 2>/dev/null | grep -E ":${BACKEND_PORT}([[:space:]]|$)" || echo "FALHA: porta ${BACKEND_PORT} não está ouvindo."
curl -sS --max-time 5 "http://127.0.0.1:${BACKEND_PORT}/health" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps({"ok":d.get("ok"),"database":d.get("database"),"version":d.get("version")}, ensure_ascii=False))' \
  || echo "FALHA: /health local não respondeu."
echo

echo "[2/4] Preflight como extensão"
curl -sS --max-time 15 -o /dev/null -D - -X OPTIONS \
  -H 'Origin: chrome-extension://diagnostico-mro' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,apikey,content-type,x-client-info,x-supabase-client-platform' \
  "https://${API_DOMAIN}/functions/v1/mro-tool-api" \
  | grep -iE '^(HTTP/|access-control-|x-cors-owner|server:|cf-ray:)' || true
echo

echo "[3/4] POST de diagnóstico sem credencial real"
HEADERS="$(mktemp)"; BODY="$(mktemp)"
trap 'rm -f "$HEADERS" "$BODY"; jobs -p | xargs -r kill 2>/dev/null || true' EXIT
STATUS="$(curl -sS --max-time 15 -o "$BODY" -D "$HEADERS" -w '%{http_code}' -X POST \
  -H 'Origin: chrome-extension://diagnostico-mro' \
  -H 'Content-Type: application/json' \
  -H 'apikey: diagnostic-probe' \
  -H 'Authorization: Bearer diagnostic-probe' \
  --data-binary '{"action":"login","username":"__mro_log_probe__","password":"__invalid__"}' \
  "https://${API_DOMAIN}/functions/v1/mro-tool-api" || true)"
echo "HTTP ${STATUS:-000}"
grep -iE '^(access-control-allow-origin|access-control-expose-headers|x-mro-request-id|x-mro-handler|x-cors-owner|content-type):' "$HEADERS" || true
python3 - "$BODY" <<'PY' || true
import json, pathlib, sys
try:
    data = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    print(json.dumps({"success": data.get("success"), "error": data.get("error"), "request_id": data.get("request_id")}, ensure_ascii=False))
except Exception as exc:
    print(f"Resposta não é JSON válido: {exc}")
PY
echo

echo "[4/4] Logs ao vivo"
echo "AGORA tente entrar pela extensão. Pare com Ctrl+C."
echo "Se não surgir MRO-CORS/MRO-API/mro-login, a chamada não chegou ao backend."
echo
touch "$API_OUT" "$API_ERROR" "$NGINX_ACCESS"
tail -n 0 -F "$API_OUT" "$API_ERROR" "$NGINX_ACCESS" "$NGINX_ERROR" 2>/dev/null \
  | grep --line-buffered -E 'MRO-CORS|MRO-API|mro-login|erro não tratado|erro do Postgres|inicialização bloqueada|mro-tool-api|upstream|connect\(\) failed'