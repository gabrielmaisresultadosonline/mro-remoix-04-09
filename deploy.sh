#!/usr/bin/env bash
# ============================================================
# COMANDO ÚNICO DE DEPLOY — VPS (PostgreSQL próprio, sem Supabase)
#
#   ./deploy.sh              → atualiza código, banco, backend e frontend
#   ./deploy.sh --migrate    → o acima + sincroniza dados/arquivos do Supabase
#   ./deploy.sh --cutover    → corte final: migra, reescreve URLs, compila o
#                              site JÁ no PostgreSQL da VPS e valida
#   ./deploy.sh --voltar     → desfaz só o corte do frontend (volta ao Supabase)

#
# Executar na raiz do projeto, na VPS, como o usuário da aplicação.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

# Este é o único repositório autorizado para atualizar a VPS. Não aceite um
# REPO_URL herdado do shell/PM2: foi exatamente isso que permitiu um deploy
# aparentemente bem-sucedido continuar publicando mro-projeto-02.
CANONICAL_REPO_URL="https://github.com/gabrielmaisresultadosonline/mro-remoix-04-09.git"
if [ -n "${REPO_URL:-}" ] && [ "${REPO_URL%/}" != "${CANONICAL_REPO_URL%/}" ]; then
  echo "ERRO: REPO_URL aponta para um repositório não autorizado: $REPO_URL" >&2
  echo "Esperado: $CANONICAL_REPO_URL" >&2
  exit 1
fi
REPO_URL="$CANONICAL_REPO_URL"

BLUE='\033[1;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${BLUE}▶ $1${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }

MIGRATE=false
CUTOVER=false
VOLTAR=false
FRONT_ENV=".env.production.local"   # não versionado; tem prioridade no build
for arg in "$@"; do
  case "$arg" in
    --migrate) MIGRATE=true ;;
    --cutover) MIGRATE=true; CUTOVER=true ;;
    --voltar)  VOLTAR=true ;;
    *) fail "Parâmetro desconhecido: $arg (use --migrate, --cutover ou --voltar)" ;;
  esac
done

# ---------- Rollback rápido do frontend (não toca no banco nem nos arquivos) ----------
if [ "$VOLTAR" = true ]; then
  step "Desfazendo o corte do frontend"
  rm -f "$FRONT_ENV"
  npm run build
  [ -n "${WEB_ROOT:-}" ] && rsync -a --delete dist/ "$WEB_ROOT/"
  command -v systemctl >/dev/null 2>&1 && sudo systemctl reload nginx || true
  ok "Site voltou a ler o Supabase. O PostgreSQL da VPS continua intacto."
  exit 0
fi



# ---------- 0. Pré-requisitos ----------
step "Verificando pré-requisitos"
for binary in node npm psql pg_dump; do
  command -v "$binary" >/dev/null 2>&1 || fail "$binary não encontrado. Rode ./deploy/install-vps.sh primeiro."
done
[ "$CUTOVER" != true ] || command -v pm2 >/dev/null 2>&1 \
  || fail "PM2 não encontrado. O corte foi bloqueado porque a API ficaria fora do ar."
[ -f server/.env ] || fail "server/.env não existe. Copie de server/.env.example e preencha."
install_deno() {
  local arch asset tmp_dir
  case "$(uname -m)" in
    x86_64|amd64) arch="x86_64-unknown-linux-gnu" ;;
    aarch64|arm64) arch="aarch64-unknown-linux-gnu" ;;
    *) return 1 ;;
  esac
  asset="https://github.com/denoland/deno/releases/latest/download/deno-${arch}.zip"
  tmp_dir="$(mktemp -d)"
  curl -fL --retry 3 --connect-timeout 15 "$asset" -o "$tmp_dir/deno.zip" || { rm -rf "$tmp_dir"; return 1; }
  command -v unzip >/dev/null 2>&1 || sudo apt-get install -y unzip
  unzip -oq "$tmp_dir/deno.zip" -d "$tmp_dir"
  sudo install -m 0755 "$tmp_dir/deno" /usr/local/bin/deno
  rm -rf "$tmp_dir"
}

if ! command -v deno >/dev/null 2>&1; then
  warn "Deno ausente; instalando o runtime obrigatório das funções."
  install_deno || true
fi

if command -v deno >/dev/null 2>&1; then
  DENO_PATH="$(command -v deno)"
  # O PM2 iniciado pelo systemd pode não herdar HOME. Um diretório fixo garante
  # que o cache preparado aqui seja o mesmo usado pelas funções em produção.
  export DENO_DIR="${DENO_DIR:-/var/cache/mro-deno}"
  sudo mkdir -p "$DENO_DIR"
  sudo chown -R "$(id -u):$(id -g)" "$DENO_DIR"
  # O daemon do PM2 pode ter um PATH diferente do shell. Persistimos o caminho
  # absoluto sem alterar as demais variáveis ou segredos existentes.
  if grep -q '^DENO_BIN=' server/.env; then
    sed -i "s|^DENO_BIN=.*|DENO_BIN=$DENO_PATH|" server/.env
  else
    printf '\nDENO_BIN=%s\n' "$DENO_PATH" >> server/.env
  fi
  if grep -q '^DENO_DIR=' server/.env; then
    sed -i "s|^DENO_DIR=.*|DENO_DIR=$DENO_DIR|" server/.env
  else
    printf 'DENO_DIR=%s\n' "$DENO_DIR" >> server/.env
  fi
  ok "Deno disponível ($(deno --version | head -1))."
elif [ "$CUTOVER" = true ]; then
  fail "Deno não pôde ser instalado. Corte bloqueado para não publicar logins sem /functions/v1."
else
  warn "Deno não encontrado: as funções (/functions/v1) não vão subir."
fi

# ── Fallback de mídias ────────────────────────────────────────────────────────
# As capas/imagens que não vieram na migração precisam de uma origem remota para
# serem baixadas no primeiro acesso. Se STORAGE_FALLBACK_URLS estiver vazio (ou
# apontando para o próprio domínio) as imagens ficam 404 para sempre.
FALLBACK_ORIGIN="https://adljdeekwifwcdcgbpit.supabase.co,https://whbqcaixxsplndmjusvo.supabase.co"
# Com `set -euo pipefail`, grep sem resultado encerrava o deploy exatamente
# depois da mensagem do Deno em instalações que ainda não tinham esta chave.
CURRENT_FALLBACK="$(grep -E '^STORAGE_FALLBACK_URLS=' server/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'' | tr -d ' ' || true)"
if [ -z "$CURRENT_FALLBACK" ] \
  || printf '%s' "$CURRENT_FALLBACK" | grep -q 'api\.maisresultadosonline\.com\.br' \
  || ! printf '%s' "$CURRENT_FALLBACK" | grep -q 'adljdeekwifwcdcgbpit\.supabase\.co'; then
  if grep -q '^STORAGE_FALLBACK_URLS=' server/.env; then
    sed -i "s|^STORAGE_FALLBACK_URLS=.*|STORAGE_FALLBACK_URLS=$FALLBACK_ORIGIN|" server/.env
  else
    printf '\nSTORAGE_FALLBACK_URLS=%s\n' "$FALLBACK_ORIGIN" >> server/.env
  fi
  ok "Fallback de mídias configurado ($FALLBACK_ORIGIN)."
fi


ok "Ambiente pronto."

# ---------- 1. Código ----------
step "Atualizando o código"
if [ -d .git ]; then
  CURRENT_REMOTE="$(git remote get-url origin 2>/dev/null || echo '')"
  # normaliza (ignora sufixo .git e barra final) para comparar com o oficial
  norm() { echo "${1%/}" | sed -E 's/\.git$//'; }
  if [ "$(norm "$CURRENT_REMOTE")" != "$(norm "$REPO_URL")" ]; then
    warn "origin apontava para: ${CURRENT_REMOTE:-<nenhum>}"
    if [ -n "$CURRENT_REMOTE" ]; then
      git remote set-url origin "$REPO_URL"
    else
      git remote add origin "$REPO_URL"
    fi
    ok "origin corrigido para $REPO_URL"
  fi

  # Fetch com verificação explícita: um fetch falhando em silêncio era a causa
  # de "deploy sem efeito" (o reset reaproveitava o origin/main antigo).
  git remote prune origin >/dev/null 2>&1 || true
  git fetch --prune --force origin main \
    || fail "Não foi possível buscar 'main' em $REPO_URL (verifique rede/credenciais do GitHub)."

  REMOTE_SHA="$(git rev-parse origin/main)"
  LOCAL_SHA="$(git rev-parse HEAD 2>/dev/null || echo '')"
  # -B garante que estamos na branch main mesmo se o clone estava em detached HEAD.
  git checkout -B main origin/main --quiet || fail "Falha ao alinhar a branch main."
  git reset --hard origin/main --quiet || fail "Falha ao aplicar origin/main."
  # Remove somente artefatos versionados removidos no repo novo; server/.env,
  # dist/, uploads/ e node_modules continuam intocados (ver .gitignore).
  git clean -fd -e server/.env -e uploads -e dist -e node_modules --quiet 2>/dev/null || true

  if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
    ok "Código já estava em $(git rev-parse --short HEAD) (nada novo em origin/main)."
  else
    ok "Código atualizado: ${LOCAL_SHA:0:7} -> $(git rev-parse --short HEAD)."
  fi
  echo "   origin: $(git remote get-url origin)"
  echo "   commit: $(git log -1 --pretty='%h %ad %s' --date=short)"

  # Guardas de versão: não basta o fetch terminar. Se estes marcadores não
  # existirem, a VPS ainda recebeu uma revisão anterior, que encaminha o login
  # ao processo Deno e volta a produzir HTTP 502 sem CORS.
  DEPLOYED_REMOTE="$(git remote get-url origin 2>/dev/null || echo '')"
  [ "$(norm "$DEPLOYED_REMOTE")" = "$(norm "$CANONICAL_REPO_URL")" ] \
    || fail "Deploy bloqueado: origin efetivo não é o repositório oficial."
  [ -f server/src/functions/lovablack-admin-native.ts ] \
    || fail "Deploy bloqueado: o handler nativo de login não existe nesta revisão."
  grep -q 'handleNativeLovablackAdminLogin' server/src/functions/host.ts \
    || fail "Deploy bloqueado: esta revisão ainda encaminha admin_login ao Deno."
  grep -q 'Login administrativo nativo respondeu na porta local' deploy.sh \
    || fail "Deploy bloqueado: validação real do login administrativo ausente."
  ok "Repositório e hotfix do login administrativo confirmados antes do build."
else
  fail "Diretório sem .git: deploy bloqueado porque não é possível confirmar o repositório oficial."
fi

# Scripts auxiliares só existem depois do sync; por isso o chmod fica aqui e não
# como pré-requisito manual (chmod antes do git falhava com "No such file").
chmod +x deploy.sh 2>/dev/null || true
for helper in deploy/*.sh; do
  [ -f "$helper" ] && chmod +x "$helper" 2>/dev/null || true
done




# ---------- 2. Dependências ----------
# Sem --silent: se o npm falhar (lockfile desatualizado, conflito de peer deps,
# falta de memória) precisamos ver o motivo em vez de sair calado.
step "Instalando dependências"
install_deps() {
  local dir="$1"
  ( cd "$dir" && { npm ci --no-audit --no-fund --legacy-peer-deps \
      || { warn "npm ci falhou em '$dir'; tentando npm install --legacy-peer-deps."
           npm install --no-audit --no-fund --legacy-peer-deps; }; } ) \
    || fail "Falha ao instalar dependências em '$dir' (veja o log acima; se foi 'Killed', a VPS ficou sem memória — adicione swap)."
}
install_deps "."
install_deps "server"
ok "Backend e frontend com dependências instaladas."

# Resolve e compila os imports remotos antes de reiniciar o serviço. Sem esse
# aquecimento, o primeiro login após cada deploy pode ficar aguardando o Deno
# baixar módulos e exceder o timeout do proxy.
if command -v deno >/dev/null 2>&1; then
  step "Preparando as funções locais"
  # --config supabase/functions/deno.json define nodeModulesDir=none. Sem isso o
  # Deno 2 usa o modo "manual" (por causa do package.json da raiz) e falha em
  # todo import npm: que não esteja em node_modules — exatamente o erro que
  # deixava /functions/v1 sem login e sem vídeo.
  if timeout 900 deno cache --config supabase/functions/deno.json supabase/functions/*/index.ts; then
    ok "Imports das Edge Functions armazenados no cache local."
  elif [ "$CUTOVER" = true ]; then
    fail "Imports das Edge Functions não resolveram. Corte bloqueado: login e vídeos dependem deles."
  else
    warn "Algum import não pôde ser pré-carregado; o backend fará nova tentativa sob demanda."
  fi
fi



# ---------- 3. Banco de dados ----------
step "Aplicando estrutura do banco"
set -a; . ./server/.env; set +a
psql -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -f server/migrations/000_bootstrap.sql >/dev/null
ok "Extensões, roles, storage, auth e realtime aplicados."

if [ -f server/migrations/001_schema_legacy.sql ]; then
  psql -v ON_ERROR_STOP=0 -d "$DATABASE_URL" -f server/migrations/001_schema_legacy.sql >/dev/null 2>&1 || true
  ok "Schema das tabelas do projeto aplicado."
fi

# Migrações extras criadas depois do corte (002_, 003_, ...).
for migration in $(ls server/migrations/0[2-9]*.sql 2>/dev/null || true); do
  psql -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -f "$migration" >/dev/null
  ok "Migração aplicada: $(basename "$migration")"
done

# ---------- 4. Migração de dados e mídias ----------
if [ "$MIGRATE" = true ]; then
  # Rede de segurança: dump do banco local ANTES de qualquer escrita.
  if [ -f server/.env ]; then
    DB_URL="$(grep -E '^DATABASE_URL=' server/.env | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
    if [ -n "${DB_URL:-}" ]; then
      BACKUP_DIR="${BACKUP_DIR:-/var/backups/mro}"
      sudo mkdir -p "$BACKUP_DIR" 2>/dev/null || mkdir -p "$BACKUP_DIR" 2>/dev/null || true
      BACKUP_FILE="$BACKUP_DIR/pg-$(date +%Y%m%d-%H%M%S).sql.gz"
      if pg_dump -d "$DB_URL" 2>/dev/null | gzip > "$BACKUP_FILE"; then
        ok "Backup do PostgreSQL local em $BACKUP_FILE"
      else
        rm -f "$BACKUP_FILE"
        warn "Não foi possível gerar o backup automático (segue adiante; nada é apagado)."
      fi
    fi
  fi

  step "Sincronizando dados e arquivos do Supabase"
  if [ "$CUTOVER" = true ]; then
    (cd server && npm run migrate:all -- --apply-urls)
  else
    (cd server && npm run migrate:all)
  fi
else
  warn "Migração de dados não solicitada (use --migrate)."
fi


# ---------- 5. Diretórios de upload ----------
step "Preparando o diretório de uploads"
STORAGE_DIR="${STORAGE_ROOT:-/var/www/uploads}"
sudo mkdir -p "$STORAGE_DIR"
# PM2 roda com o mesmo usuário que executa este deploy. Garantimos escrita em
# toda a árvore para uploads novos e leitura pelo Nginx sem apagar nada.
sudo chown -R "$(id -u):$(id -g)" "$STORAGE_DIR"
sudo find "$STORAGE_DIR" -type d -exec chmod 755 {} +
sudo find "$STORAGE_DIR" -type f -exec chmod 644 {} +
mkdir -p "$STORAGE_DIR/assets/announcements"
STORAGE_PROBE="$STORAGE_DIR/assets/announcements/.deploy-write-test"
printf 'ok' > "$STORAGE_PROBE" || fail "Sem permissão de escrita em $STORAGE_DIR/assets/announcements."
rm -f "$STORAGE_PROBE"
ok "Uploads em $STORAGE_DIR ($(du -sh "$STORAGE_DIR" 2>/dev/null | cut -f1) usados)."

# ---------- 6. Frontend ----------
# No corte final o site precisa ser compilado com VITE_USE_LOCAL_BACKEND=true;
# sem isso as 213 páginas continuariam falando com o Supabase mesmo já tendo o
# banco e as mídias na VPS. As chaves vêm do server/.env que já está no disco.
if [ "$CUTOVER" = true ]; then
  step "Apontando o site para o backend próprio"
  [ -n "${ANON_KEY:-}" ] || fail "ANON_KEY vazio em server/.env — é a chave que o site usa para falar com a API."
  API_URL_FINAL="${PUBLIC_API_URL:-https://api.maisresultadosonline.com.br}"
  cat > "$FRONT_ENV" <<EOF
# Gerado por deploy.sh --cutover em $(date -Is). Remova com ./deploy.sh --voltar.
VITE_USE_LOCAL_BACKEND=true
VITE_API_URL=$API_URL_FINAL
VITE_API_ANON_KEY=$ANON_KEY
VITE_SUPABASE_URL=$API_URL_FINAL
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
EOF
  chmod 600 "$FRONT_ENV"
  ok "Build usará $API_URL_FINAL."
fi

step "Compilando o site"
npm run build
[ -d dist ] || fail "Build não gerou a pasta dist/."
ok "Site compilado ($(du -sh dist | cut -f1))."


if [ -n "${WEB_ROOT:-}" ]; then
  rsync -a --delete dist/ "$WEB_ROOT/"
  ok "Publicado em $WEB_ROOT."
else
  warn "WEB_ROOT não definido; o Nginx deve apontar para $(pwd)/dist."
fi

# ---------- 7. Serviços ----------
step "Reiniciando o backend"
if command -v pm2 >/dev/null 2>&1; then
  # Para o host antes de matar seus filhos. Assim não sobra no processo Node um
  # mapa apontando para runners/portas já encerrados (causa de 502 pós-deploy).
  pm2 delete mro-api >/dev/null 2>&1 || true
  pkill -f '[r]unner\.ts' 2>/dev/null || true
  pm2 start ecosystem.config.cjs --update-env
  pm2 save >/dev/null
  ok "PM2 recarregado."
else
  warn "PM2 não instalado: rode 'npm i -g pm2' para manter o backend no ar."
fi

# ---------- 8. Verificação ----------
step "Checando a saúde do sistema"
PORT_LOCAL="${PORT:-8787}"
for attempt in $(seq 1 20); do
  if HEALTH_JSON="$(curl -sf --max-time 3 "http://127.0.0.1:${PORT_LOCAL}/health")" \
    && printf '%s' "$HEALTH_JSON" | grep -q '"ok":true'; then
    printf '%s' "$HEALTH_JSON" | head -c 400; echo
    ok "Backend respondendo na porta ${PORT_LOCAL}."
    break
  fi
  if [ "$attempt" = "20" ]; then
    pm2 status mro-api 2>/dev/null || true
    tail -n 40 /var/log/mro/api-error.log 2>/dev/null || true
    fail "Backend não respondeu de forma saudável em /health."
  fi
  sleep 1
done

# Testa exatamente o fluxo usado pelo painel de avisos: corpo binário, bucket
# assets e subdiretório announcements. Se falhar, exibe os logs e interrompe o
# deploy em vez de deixar o erro aparecer depois no navegador.
UPLOAD_CHECK_NAME="announcements/.deploy-${RANDOM}-$(date +%s).jpg"
UPLOAD_CHECK_BODY="$(mktemp)"
printf '\377\330\377\331' > "$UPLOAD_CHECK_BODY"
UPLOAD_CHECK_STATUS="$(curl -sS --max-time 15 -o /tmp/mro-upload-check-response -w '%{http_code}' -X PUT \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: image/jpeg" \
  -H "x-upsert: true" \
  --data-binary "@$UPLOAD_CHECK_BODY" \
  "http://127.0.0.1:${PORT_LOCAL}/storage/v1/object/assets/${UPLOAD_CHECK_NAME}" || true)"
rm -f "$UPLOAD_CHECK_BODY"
if [ "$UPLOAD_CHECK_STATUS" = "200" ]; then
  rm -f "$STORAGE_DIR/assets/$UPLOAD_CHECK_NAME"
  psql -v ON_ERROR_STOP=0 -d "$DATABASE_URL" \
    -c "DELETE FROM storage_objects WHERE bucket_id = 'assets' AND name = '${UPLOAD_CHECK_NAME}'" >/dev/null 2>&1 || true
  ok "Upload de imagens dos avisos validado no armazenamento local."
else
  echo "  Resposta do upload (${UPLOAD_CHECK_STATUS:-sem status}):"
  head -c 2000 /tmp/mro-upload-check-response 2>/dev/null || true; echo
  tail -n 80 /var/log/mro/api-error.log 2>/dev/null || true
  fail "Upload local indisponível; deploy bloqueado para evitar falhas no /admin."
fi
rm -f /tmp/mro-upload-check-response

# Atualiza somente a rota pública de mídia dentro do virtual host já ativo.
# O restante da configuração (incluindo certificados TLS) é preservado.
if command -v nginx >/dev/null 2>&1 && [ -d /etc/nginx/sites-enabled ]; then
  step "Configurando streaming de mídias no Nginx"
  API_DOMAIN="$(echo "${PUBLIC_API_URL:-api.maisresultadosonline.com.br}" | sed -E 's|https?://||; s|/.*$||')"
  # -R segue os links de sites-enabled. A busca ampla também cobre instalações
  # que mantêm o vhost diretamente em nginx.conf ou apenas em sites-available.
  API_NGINX_CONFIG="$(sudo grep -RlE --include='*.conf' --include='*mro*' --include='*api*' \
    "server_name.*$API_DOMAIN" /etc/nginx 2>/dev/null \
    | grep -vE '\.(pre-media-hotfix|bak|backup|disabled)$' | head -1 || true)"
  if [ -n "$API_NGINX_CONFIG" ]; then
    sudo python3 - "$API_NGINX_CONFIG" "$API_DOMAIN" <<'PY'
import pathlib, re, sys
config_path = pathlib.Path(sys.argv[1])
api_domain = sys.argv[2]
text = config_path.read_text()
# O Express é a única autoridade de CORS. Removemos regras antigas do Nginx
# porque combinar a origem devolvida pelo backend com "*" produz dois valores
# em Access-Control-Allow-Origin e o navegador bloqueia o preflight.
text = re.sub(
    r"(?mi)^\s*add_header\s+['\"]?Access-Control-(?:Allow|Expose)-[A-Za-z-]+['\"]?\s+.*?;\s*$\n?",
    "",
    text,
)
# Configurações anteriores respondiam OPTIONS diretamente no Nginx. Sem os
# headers removidos acima isso viraria um 204 sem CORS; encaminhamos o preflight
# ao middleware cors() do backend, que reflete uma única origem autorizada.
text = re.sub(
    r"(?ms)^\s*if\s*\(\s*\$request_method\s*=\s*['\"]?OPTIONS['\"]?\s*\)\s*\{[^{}]*?return\s+204;[^{}]*?\}\s*",
    "",
    text,
)
storage_block = """    location /storage/v1/ {
        client_max_body_size 300m;
        # Declarar qualquer add_header neste nível interrompe a herança dos
        # add_header definidos no bloco server/http. O CORS real continua vindo
        # intacto do backend por proxy_pass.
        add_header X-Cors-Owner "backend" always;
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
    }"""
functions_block = """    location /functions/v1/ {
        add_header X-Cors-Owner "backend" always;
        proxy_pass http://127.0.0.1:8787;
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
    }"""
loc_regex = re.compile(r"(?ms)^\s*location\s+/storage/v1/(?:object/public/)?\s*\{[^{}]*\}")
fn_regex = re.compile(r"(?ms)^\s*location\s+/functions/v1/?\s*\{[^{}]*\}")
if loc_regex.search(text):
    updated = loc_regex.sub(storage_block, text, count=1)
else:
    server_blocks = re.split(r"(server\s*\{)", text)
    new_parts, found = [], False
    for i in range(len(server_blocks)):
        part = server_blocks[i]
        if not found and api_domain in part:
            last_brace = part.rfind("}")
            if last_brace != -1: part = part[:last_brace] + "\n" + storage_block + "\n" + part[last_brace:]; found = True
        new_parts.append(part)
    updated = "".join(new_parts)
if fn_regex.search(updated):
    updated = fn_regex.sub(functions_block, updated, count=1)
else:
    generic_location = re.search(r"(?m)^\s*location\s+/\s*\{", updated)
    if generic_location:
        updated = updated[:generic_location.start()] + functions_block + "\n\n" + updated[generic_location.start():]
if updated != text:
    config_path.with_suffix(config_path.suffix + ".pre-media-hotfix").write_text(text)
    config_path.write_text(updated)
PY
    sudo nginx -t || fail "Configuração do Nginx inválida; o arquivo anterior foi preservado em .pre-media-hotfix."
    ok "Funções, uploads e mídias públicas encaminhados ao backend local."
  else
    warn "Virtual host da API não localizado; preservando a configuração atual."
  fi
fi

# Recarrega o Nginx (site estático em dist/) para servir o build novo.
command -v systemctl >/dev/null 2>&1 && sudo systemctl reload nginx && ok "Nginx recarregado."

if [ "$CUTOVER" = true ]; then
  # Reproduz o POST binário feito por storage.from(...).upload() usando o mesmo
  # domínio HTTPS do navegador. O teste interno isolado não detecta bloqueios,
  # aliases antigos ou limites incorretos do Nginx.
  PUBLIC_UPLOAD_NAME="announcements/.deploy-public-${RANDOM}-$(date +%s).jpg"
  PUBLIC_UPLOAD_BODY="$(mktemp)"
  PUBLIC_UPLOAD_RESPONSE="$(mktemp)"
  printf '\377\330\377\331' > "$PUBLIC_UPLOAD_BODY"
  PUBLIC_UPLOAD_STATUS="$(curl -sS --max-time 20 -o "$PUBLIC_UPLOAD_RESPONSE" -w '%{http_code}' -X POST \
    -H "Origin: https://maisresultadosonline.com.br" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "x-upsert: true" \
    -F "=@$PUBLIC_UPLOAD_BODY;type=image/jpeg;filename=deploy-check.jpg" \
    "${API_URL_FINAL%/}/storage/v1/object/assets/${PUBLIC_UPLOAD_NAME}" || true)"
  rm -f "$PUBLIC_UPLOAD_BODY"
  if [ "$PUBLIC_UPLOAD_STATUS" = "200" ]; then
    rm -f "$STORAGE_DIR/assets/$PUBLIC_UPLOAD_NAME"
    psql -v ON_ERROR_STOP=0 -d "$DATABASE_URL" \
      -c "DELETE FROM storage_objects WHERE bucket_id = 'assets' AND name = '${PUBLIC_UPLOAD_NAME}'" >/dev/null 2>&1 || true
    ok "Upload de thumbnail validado pelo domínio público."
  else
    echo "  Resposta pública do storage (${PUBLIC_UPLOAD_STATUS:-sem status}):"
    head -c 2000 "$PUBLIC_UPLOAD_RESPONSE" 2>/dev/null || true; echo
    tail -n 100 /var/log/mro/api-error.log 2>/dev/null || true
    rm -f "$PUBLIC_UPLOAD_RESPONSE"
    fail "Upload público indisponível; deploy bloqueado para evitar falhas no /admin."
  fi
  rm -f "$PUBLIC_UPLOAD_RESPONSE"

  # O navegador faz OPTIONS antes do upload. Exigimos exatamente um header com
  # a origem do site; curl aceitaria cabeçalhos duplicados, mas o browser não.
  STORAGE_CORS_HEADERS="$(mktemp)"
  STORAGE_CORS_STATUS="$(curl -sS --max-time 10 -X OPTIONS \
      -H "Origin: https://maisresultadosonline.com.br" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: authorization,apikey,content-type,x-client-info" \
      -D "$STORAGE_CORS_HEADERS" -o /dev/null -w '%{http_code}' \
      "${API_URL_FINAL%/}/storage/v1/object/assets/announcements/.cors-check.jpg" || true)"
  STORAGE_CORS_COUNT="$(grep -ci '^access-control-allow-origin:' "$STORAGE_CORS_HEADERS" || true)"
  STORAGE_CORS_VALUE="$(grep -i '^access-control-allow-origin:' "$STORAGE_CORS_HEADERS" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
  if [ "$STORAGE_CORS_STATUS" = "204" ] \
      && [ "$STORAGE_CORS_COUNT" = "1" ] \
      && [ "$STORAGE_CORS_VALUE" = "https://maisresultadosonline.com.br" ]; then
    ok "Preflight do upload validado com uma única origem CORS."
  else
    echo "  OPTIONS storage: HTTP ${STORAGE_CORS_STATUS:-sem status}; headers CORS: $STORAGE_CORS_COUNT; origem: ${STORAGE_CORS_VALUE:-ausente}"
    cat "$STORAGE_CORS_HEADERS" 2>/dev/null || true
    if [ "$STORAGE_CORS_COUNT" -gt 1 ] && grep -qi '^server: cloudflare' "$STORAGE_CORS_HEADERS"; then
      warn "Se X-Cors-Owner: backend aparecer acima, o '*' não vem mais do Nginx: remova uma regra de Response Header Transform do proxy Cloudflare que adiciona Access-Control-Allow-Origin."
    fi
    rm -f "$STORAGE_CORS_HEADERS"
    fail "CORS público do upload inválido; deploy bloqueado para evitar falha no /admin."
  fi
  rm -f "$STORAGE_CORS_HEADERS"

  # As extensões (MRO Ferramenta e ZAP MRO) leem user-data/admin/*.json de
  # origens externas. Essa leitura pública precisa responder com wildcard.
  PUBLIC_JSON_HEADERS="$(mktemp)"
  PUBLIC_JSON_STATUS="$(curl -sS --max-time 10 -X OPTIONS \
      -H "Origin: chrome-extension://mroferramenta" \
      -H "Access-Control-Request-Method: GET" \
      -D "$PUBLIC_JSON_HEADERS" -o /dev/null -w '%{http_code}' \
      "${API_URL_FINAL%/}/storage/v1/object/public/user-data/admin/extension-announcements.json" || true)"
  PUBLIC_JSON_VALUE="$(grep -i '^access-control-allow-origin:' "$PUBLIC_JSON_HEADERS" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
  if [ "$PUBLIC_JSON_STATUS" = "204" ] && [ "$PUBLIC_JSON_VALUE" = "*" ]; then
    ok "CORS público (wildcard) validado em user-data/admin/*.json."
  else
    echo "  OPTIONS público: HTTP ${PUBLIC_JSON_STATUS:-sem status}; origem: ${PUBLIC_JSON_VALUE:-ausente}"
    cat "$PUBLIC_JSON_HEADERS" 2>/dev/null || true
    warn "Leitura pública de user-data/admin/*.json sem wildcard — extensões externas podem falhar por CORS."
  fi
  rm -f "$PUBLIC_JSON_HEADERS"


  # O login da extensão envia JSON e headers do cliente, portanto sempre faz
  # preflight. Validamos esse OPTIONS separadamente para não confundir um POST
  # funcional no curl com CORS realmente liberado no navegador/Instagram.
  MRO_CORS_HEADERS="$(mktemp)"
  MRO_CORS_STATUS="$(curl -sS --max-time 15 -X OPTIONS \
      -H "Origin: chrome-extension://mroferramenta" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: authorization,apikey,content-type,x-client-info,x-supabase-client-platform" \
      -D "$MRO_CORS_HEADERS" -o /dev/null -w '%{http_code}' \
      "${API_URL_FINAL%/}/functions/v1/mro-tool-api" || true)"
  MRO_CORS_COUNT="$(grep -ci '^access-control-allow-origin:' "$MRO_CORS_HEADERS" || true)"
  MRO_CORS_ORIGIN="$(grep -i '^access-control-allow-origin:' "$MRO_CORS_HEADERS" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
  MRO_CORS_METHODS="$(grep -i '^access-control-allow-methods:' "$MRO_CORS_HEADERS" | head -1 | tr -d '\r' || true)"
  MRO_CORS_ALLOWED="$(grep -i '^access-control-allow-headers:' "$MRO_CORS_HEADERS" | head -1 | tr -d '\r' || true)"
  if [ "$MRO_CORS_STATUS" = "204" ] \
      && [ "$MRO_CORS_COUNT" = "1" ] \
      && { [ "$MRO_CORS_ORIGIN" = "*" ] || [ "$MRO_CORS_ORIGIN" = "chrome-extension://mroferramenta" ]; } \
      && [[ "$MRO_CORS_METHODS" == *"POST"* ]] \
      && [[ "${MRO_CORS_ALLOWED,,}" == *"authorization"* ]] \
      && [[ "${MRO_CORS_ALLOWED,,}" == *"apikey"* ]] \
      && [[ "${MRO_CORS_ALLOWED,,}" == *"content-type"* ]] \
      && [[ "${MRO_CORS_ALLOWED,,}" == *"x-client-info"* ]] \
      && [[ "${MRO_CORS_ALLOWED,,}" == *"x-supabase-client-platform"* ]]; then
    ok "Preflight da mro-tool-api liberado para a extensão (HTTP 204, CORS completo)."
  else
    echo "  OPTIONS mro-tool-api: HTTP ${MRO_CORS_STATUS:-sem status}; headers CORS: $MRO_CORS_COUNT; origem: ${MRO_CORS_ORIGIN:-ausente}"
    echo "  ${MRO_CORS_METHODS:-Access-Control-Allow-Methods ausente}"
    echo "  ${MRO_CORS_ALLOWED:-Access-Control-Allow-Headers ausente}"
    cat "$MRO_CORS_HEADERS" 2>/dev/null || true
    rm -f "$MRO_CORS_HEADERS"
    fail "CORS da mro-tool-api inválido; deploy bloqueado para evitar falha no login da extensão."
  fi
  rm -f "$MRO_CORS_HEADERS"


  # Confere de fato pela porta pública se a API responde com a chave anônima:
  # é isso que o navegador vai fazer em cada página.
  curl -sf --max-time 5 -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    "http://127.0.0.1:${PORT_LOCAL}/rest/v1/hub_products?select=id&limit=1" >/dev/null \
    && ok "REST respondendo com a chave anônima do site." \
    || warn "REST não respondeu como esperado — confira RLS/ANON_KEY antes de divulgar."

  # Outras áreas dependem de Edge Functions. Um /health saudável não basta:
  # iniciamos uma função Deno real pelo mesmo proxy usado no navegador.
  FUNCTION_CHECK_BODY="$(mktemp)"
  FUNCTION_CHECK_STATUS=""
  if FUNCTION_CHECK_STATUS="$(curl -sS --max-time 75 -o "$FUNCTION_CHECK_BODY" -w '%{http_code}' -X POST \
      -H "Origin: https://maisresultadosonline.com.br" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ANON_KEY" \
      -H "Content-Type: application/json" \
      --data '{"action":"verify_user","username":"__deploy_healthcheck__"}' \
      "${API_URL_FINAL%/}/functions/v1/mro-tool-api")" \
      && [[ "$FUNCTION_CHECK_STATUS" =~ ^[234] ]]; then
    ok "Runtime de Edge Functions respondeu integralmente pelo domínio público."
  else
    echo "  Resposta pública (${FUNCTION_CHECK_STATUS:-sem status}):"
    head -c 4000 "$FUNCTION_CHECK_BODY" 2>/dev/null || true; echo
    echo "  Últimas saídas do backend:"
    tail -n 100 /var/log/mro/api-out.log 2>/dev/null || true
    tail -n 100 /var/log/mro/api-error.log 2>/dev/null || true
    rm -f "$FUNCTION_CHECK_BODY"
    fail "Edge Functions indisponíveis; corte bloqueado para evitar falhas nas áreas dependentes."
  fi
  rm -f "$FUNCTION_CHECK_BODY"

  # Autenticação administrativa: uma chamada real precisa atravessar CDN,
  # Nginx e o handler Express nativo (sem iniciar Deno). Além do 401 esperado
  # para dados inválidos, validamos o CORS que o navegador exige. Assim uma
  # revisão antiga ou um 502 nunca mais passa pelo deploy como sucesso.
  ADMIN_LOGIN_HEADERS="$(mktemp)"
  ADMIN_LOGIN_BODY="$(mktemp)"
  # Primeiro validamos diretamente o Express. Se isto falhar, o diagnóstico é
  # local (PM2/backend/banco), sem mascaramento da CDN ou do Nginx.
  ADMIN_LOCAL_STATUS="$(curl -sS --max-time 15 -o "$ADMIN_LOGIN_BODY" -w '%{http_code}' -X POST \
    -H "Origin: https://maisresultadosonline.com.br" \
    -H "Content-Type: application/json" \
    --data '{"action":"admin_login","email":"deploy-check@invalid.local","password":"deploy-check-invalid"}' \
    "http://127.0.0.1:${PORT_LOCAL}/functions/v1/lovablack-api" || true)"
  if [ "$ADMIN_LOCAL_STATUS" != "401" ]; then
    echo "  Login admin local: HTTP ${ADMIN_LOCAL_STATUS:-sem status}"
    head -c 2000 "$ADMIN_LOGIN_BODY" 2>/dev/null || true; echo
    tail -n 150 /var/log/mro/api-out.log 2>/dev/null || true
    tail -n 150 /var/log/mro/api-error.log 2>/dev/null || true
    echo "  Diagnóstico adicional: bash deploy/diagnose-admin-login.sh"
    rm -f "$ADMIN_LOGIN_HEADERS" "$ADMIN_LOGIN_BODY"
    fail "Login administrativo falhou diretamente no backend local."
  fi
  ok "Login administrativo nativo respondeu na porta local."

  ADMIN_LOGIN_STATUS="$(curl -sS --max-time 75 -D "$ADMIN_LOGIN_HEADERS" -o "$ADMIN_LOGIN_BODY" -w '%{http_code}' -X POST \
    -H "Origin: https://maisresultadosonline.com.br" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    --data '{"action":"admin_login","email":"deploy-check@invalid.local","password":"deploy-check-invalid"}' \
    "${API_URL_FINAL%/}/functions/v1/lovablack-api" || true)"
  ADMIN_LOGIN_CORS_COUNT="$(grep -ci '^access-control-allow-origin:' "$ADMIN_LOGIN_HEADERS" || true)"
  ADMIN_LOGIN_CORS_VALUE="$(grep -i '^access-control-allow-origin:' "$ADMIN_LOGIN_HEADERS" | head -1 | tr -d '\r' | cut -d: -f2- | xargs || true)"
  if [ "$ADMIN_LOGIN_STATUS" = "401" ] \
      && [ "$ADMIN_LOGIN_CORS_COUNT" = "1" ] \
      && [ "$ADMIN_LOGIN_CORS_VALUE" = "https://maisresultadosonline.com.br" ]; then
    ok "Login administrativo ativo, recusando senha inválida e com CORS válido."
  else
    echo "  Login admin: HTTP ${ADMIN_LOGIN_STATUS:-sem status}; headers CORS: $ADMIN_LOGIN_CORS_COUNT; origem: ${ADMIN_LOGIN_CORS_VALUE:-ausente}"
    head -c 2000 "$ADMIN_LOGIN_BODY" 2>/dev/null || true; echo
    echo "  Diagnóstico Nginx/PM2 (sem exibir variáveis de ambiente):"
    sudo nginx -T 2>/dev/null | grep -nE "server_name .*${API_DOMAIN}|location /functions/v1|proxy_pass http://127.0.0.1" | tail -n 30 || true
    pm2 describe mro-api 2>/dev/null | grep -E "status|script path|exec cwd|restarts|uptime" || true
    tail -n 100 /var/log/mro/api-error.log 2>/dev/null || true
    echo "  Diagnóstico adicional: bash deploy/diagnose-admin-login.sh"
    rm -f "$ADMIN_LOGIN_HEADERS" "$ADMIN_LOGIN_BODY"
    fail "Login administrativo indisponível ou sem CORS; deploy bloqueado."
  fi
  rm -f "$ADMIN_LOGIN_HEADERS" "$ADMIN_LOGIN_BODY"

  ACCESS_GUARD_STATUS="$(curl -sS --max-time 60 -o /dev/null -w '%{http_code}' -X POST \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    --data '{"action":"list_accesses"}' \
    "${API_URL_FINAL%/}/functions/v1/manage-user-access" || true)"
  if [ "$ACCESS_GUARD_STATUS" = "401" ]; then
    ok "Endpoint de acessos protegido por sessão administrativa."
  else
    warn "manage-user-access respondeu HTTP ${ACCESS_GUARD_STATUS:-sem status} sem token (esperado 401)."
  fi

  # Esta função consulta o PostgreSQL e entrega a configuração dos vídeos;
  # portanto testa de uma vez proxy, runtime Deno e acesso interno ao REST.
  if curl -sf --max-time 70 -X POST \
      -H "Origin: https://maisresultadosonline.com.br" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ANON_KEY" \
      -H "Content-Type: application/json" \
      --data '{"action":"get_video"}' \
      "${API_URL_FINAL%/}/functions/v1/ferramentamropromo-video" >/dev/null; then
    ok "Função de vídeo respondeu usando o PostgreSQL local."
  else
    tail -n 80 /var/log/mro/api-error.log 2>/dev/null || true
    fail "Função de vídeo indisponível; deploy bloqueado para evitar páginas sem mídia."
  fi
fi

echo -e "\n${GREEN}═══ Deploy concluído ═══${NC}"
if [ "$CUTOVER" = true ]; then
  echo -e "${YELLOW}Corte final aplicado: banco, mídias E site agora no PostgreSQL da VPS.${NC}"
  echo "O Supabase segue intacto como backup. Para reverter só o site: ./deploy.sh --voltar"
fi
exit 0

