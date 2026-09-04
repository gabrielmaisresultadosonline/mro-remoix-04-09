#!/usr/bin/env bash
# Corrige uma VPS que ainda esteja presa ao repositório mro-projeto-02 e inicia
# o deploy oficial. Não lê, imprime, substitui ou remove secrets, banco/uploads.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/ia-mro}"
REPO_URL="https://github.com/gabrielmaisresultadosonline/mro-remoix-04-09.git"

fail() {
  echo "ERRO: $1" >&2
  exit 1
}

cd "$APP_DIR" || fail "diretório $APP_DIR não existe"
[ -d .git ] || fail "$APP_DIR não é um repositório Git"
[ -f server/.env ] || fail "server/.env ausente; interrompido para preservar a configuração existente"

echo "Corrigindo origin para o repositório oficial..."
git remote set-url origin "$REPO_URL"
[ "$(git remote get-url origin)" = "$REPO_URL" ] || fail "não foi possível corrigir o origin"

git fetch --prune --force origin main
git checkout -B main origin/main
git reset --hard origin/main

[ -f server/src/functions/lovablack-admin-native.ts ] \
  || fail "a revisão recebida não contém o handler nativo de login"
grep -q 'handleNativeLovablackAdminLogin' server/src/functions/host.ts \
  || fail "a revisão recebida não ativa o handler nativo de login"

echo "origin: $(git remote get-url origin)"
echo "commit: $(git rev-parse --short HEAD)"
chmod +x deploy.sh
exec ./deploy.sh --cutover