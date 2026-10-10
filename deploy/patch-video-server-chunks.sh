#!/bin/bash
# Ativa o envio de vídeo em partes no video-server existente, sem apagar vídeos.
# Idempotente: pode rodar várias vezes. Faz backup e desfaz se algo falhar.
#
# Uso: sudo bash deploy/patch-video-server-chunks.sh
set -u

VS_DIR="${VIDEO_SERVER_DIR:-/var/www/video-server}"
SERVER_JS="$VS_DIR/server.js"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_SRC="$SRC_DIR/video-server/chunk-upload.js"
MARKER="// [mro-chunk-upload]"

echo "🎬 Video-server: envio em partes (Cloudflare limita 100MB por requisição)"

if [ ! -f "$SERVER_JS" ]; then
  echo "⚠️  $SERVER_JS não encontrado — video-server não está nesta VPS. Nada alterado."
  exit 0
fi
if [ ! -f "$MODULE_SRC" ]; then
  echo "❌ Módulo $MODULE_SRC ausente nesta revisão."; exit 1
fi

BACKUP_JS="$SERVER_JS.bak-chunks-$(date +%Y%m%d%H%M%S)"
cp "$SERVER_JS" "$BACKUP_JS"
[ -f "$VS_DIR/chunk-upload.js" ] && cp "$VS_DIR/chunk-upload.js" "$VS_DIR/chunk-upload.js.bak" || true
cp "$MODULE_SRC" "$VS_DIR/chunk-upload.js"

if ! grep -qF "$MARKER" "$SERVER_JS"; then
  if ! grep -q "app.post('/api/video/upload'" "$SERVER_JS"; then
    echo "❌ Rota /api/video/upload não encontrada no server.js; não é seguro alterar."
    exit 1
  fi
  # Insere o registro das rotas logo antes da rota de upload original.
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const marker = process.argv[2];
    let src = fs.readFileSync(file, "utf8");
    const anchor = "app.post(\x27/api/video/upload\x27";
    const line = marker + "\ntry { require(\x27./chunk-upload.js\x27)(app, {\n" +
      "  UPLOAD_ROOT: typeof UPLOAD_ROOT !== \x27undefined\x27 ? UPLOAD_ROOT : null,\n" +
      "  HLS_ROOT: typeof HLS_ROOT !== \x27undefined\x27 ? HLS_ROOT : null,\n" +
      "  sanitizeBaseName: typeof sanitizeBaseName === \x27function\x27 ? sanitizeBaseName : null,\n" +
      "  writeJob: typeof writeJob === \x27function\x27 ? writeJob : null,\n" +
      "  publicHlsUrl: typeof publicHlsUrl === \x27function\x27 ? publicHlsUrl : null,\n" +
      "  startTranscoding: typeof startTranscoding === \x27function\x27 ? startTranscoding : null,\n" +
      "}); } catch (e) { console.error(\x27[chunk-upload] falhou ao registrar:\x27, e); }\n\n";
    src = src.replace(anchor, line + anchor);
    fs.writeFileSync(file, src);
  ' "$SERVER_JS" "$MARKER"
  echo "✅ Rotas de envio em partes adicionadas ao server.js"
else
  echo "✅ server.js já tinha o envio em partes (módulo atualizado)"
fi

restore() {
  echo "❌ $1 — restaurando versão anterior do video-server."
  cp "$BACKUP_JS" "$SERVER_JS"
  [ -f "$VS_DIR/chunk-upload.js.bak" ] && cp "$VS_DIR/chunk-upload.js.bak" "$VS_DIR/chunk-upload.js"
  (cd "$VS_DIR" && pm2 restart video-server --update-env >/dev/null 2>&1) || true
  exit 1
}

node --check "$SERVER_JS" || restore "Erro de sintaxe"
node --check "$VS_DIR/chunk-upload.js" || restore "Erro de sintaxe no módulo"

if command -v pm2 >/dev/null 2>&1; then
  (cd "$VS_DIR" && pm2 restart video-server --update-env >/dev/null 2>&1) \
    || (cd "$VS_DIR" && pm2 start server.js --name video-server --update-env >/dev/null)
  pm2 save >/dev/null 2>&1 || true
fi

VS_PORT="${VIDEO_SERVER_PORT:-3001}"
for i in $(seq 1 30); do
  if curl -sf --max-time 3 "http://127.0.0.1:${VS_PORT}/api/video/chunk/health" | grep -q '"chunked":true'; then
    echo "✅ Envio em partes ativo (porta ${VS_PORT})."
    exit 0
  fi
  sleep 1
done
pm2 logs video-server --lines 40 --nostream 2>/dev/null || true
restore "Video-server não respondeu à rota de envio em partes"
