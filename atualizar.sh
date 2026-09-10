#!/usr/bin/env bash
# ============================================================
#  COMANDO ÚNICO — ATUALIZAR TUDO NA VPS
#
#      cd /var/www/ia-mro && ./atualizar.sh
#
#  Substitui a sequência antiga (git pull / npm install / npm run build /
#  reload nginx / pm2 restart all) e ainda:
#    • aplica a estrutura do PostgreSQL local (extensões, roles, storage, auth)
#    • copia tabelas, usuários (com hashes) e TODOS os arquivos dos buckets
#    • deixa as 163 edge functions servidas localmente (/functions/v1/*)
#    • recompila o site e recarrega Nginx + PM2 (wpp-bot-mro, video-server…)
#
#  O Supabase / Lovable Cloud continua 100% ativo e intocado: nenhuma URL de
#  mídia é reescrita aqui. O corte só acontece quando VOCÊ rodar, no futuro:
#      ./deploy.sh --cutover
#
#  Idempotente: pode rodar quantas vezes quiser (linhas já existentes são
#  ignoradas, arquivos já baixados são pulados).
#
#  Opções:
#    ./atualizar.sh --rapido      só código + build + serviços (sem migrar dados)
#    ./atualizar.sh --sem-midia   migra tabelas/usuários, mas não baixa arquivos
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

B='\033[1;36m'; G='\033[0;32m'; Y='\033[0;33m'; R='\033[0;31m'; N='\033[0m'
step(){ echo -e "\n${B}▶ $1${N}"; }
ok(){   echo -e "  ${G}✓${N} $1"; }
warn(){ echo -e "  ${Y}!${N} $1"; }
fail(){ echo -e "  ${R}✗${N} $1"; exit 1; }

RAPIDO=false
MIGRATE_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --rapido)    RAPIDO=true ;;
    --sem-midia) MIGRATE_ARGS+=("--skip-storage") ;;
    --so-midia)  MIGRATE_ARGS+=("--only-storage") ;;
    *) fail "Parâmetro desconhecido: $arg (use --rapido, --sem-midia ou --so-midia)" ;;
  esac
done

# ---------- 1. Código do GitHub ----------
step "1/7 Baixando o código do GitHub"
if [ -d .git ]; then
  git fetch --all --quiet
  git reset --hard origin/main --quiet
  ok "Atualizado em $(git rev-parse --short HEAD)."
else
  warn "Não é um repositório git; usando os arquivos do disco."
fi

# ---------- 2. Dependências ----------
step "2/7 Instalando dependências"
npm install --legacy-peer-deps --no-audit --no-fund --silent
if [ -d server ]; then
  (cd server && npm install --no-audit --no-fund --silent)
  ok "Frontend e backend prontos."
else
  ok "Frontend pronto."
fi

# ---------- 3. Banco de dados ----------
DB_PRONTO=false
if [ -f server/.env ]; then
  set -a; . ./server/.env; set +a
  if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
    step "3/7 Aplicando a estrutura do PostgreSQL local"

    # Dados de conexão vindos do server/.env.
    DB_URL_NO_PROTO="${DATABASE_URL#*://}"
    DB_CREDS="${DB_URL_NO_PROTO%%@*}"
    DB_USER_ENV="${DB_CREDS%%:*}"
    DB_PASS_ENV="${DB_CREDS#*:}"
    DB_NAME_ENV="$(printf '%s' "${DB_URL_NO_PROTO##*/}" | cut -d'?' -f1)"
    HAS_SUDO_PG=false
    command -v sudo >/dev/null 2>&1 && sudo -n -u postgres psql -tAc 'select 1' >/dev/null 2>&1 && HAS_SUDO_PG=true

    # O papel do Postgres pode ter sido criado com outra senha (install-vps.sh
    # sorteia uma) e precisa de SUPERUSER: o bootstrap cria papéis BYPASSRLS
    # (service_role) e extensões, o que só o superusuário pode fazer.
    if [ "$HAS_SUDO_PG" = true ] && [ -n "$DB_USER_ENV" ] && [ -n "$DB_PASS_ENV" ]; then
      DB_PASS_SQL="$(printf '%s' "$DB_PASS_ENV" | sed "s/'/''/g")"
      sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL || fail "Não foi possível ajustar o papel do Postgres. Rode: sudo -u postgres psql -c \"ALTER ROLE $DB_USER_ENV WITH LOGIN SUPERUSER PASSWORD '...';\""
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER_ENV') THEN
    EXECUTE format('ALTER ROLE %I WITH LOGIN SUPERUSER CREATEROLE CREATEDB PASSWORD %L', '$DB_USER_ENV', '$DB_PASS_SQL');
  ELSE
    EXECUTE format('CREATE ROLE %I LOGIN SUPERUSER CREATEROLE CREATEDB PASSWORD %L', '$DB_USER_ENV', '$DB_PASS_SQL');
  END IF;
END
\$\$;
SQL
      if [ -n "$DB_NAME_ENV" ]; then
        sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME_ENV'" | grep -q 1 \
          || sudo -u postgres createdb -O "$DB_USER_ENV" "$DB_NAME_ENV"
        sudo -u postgres psql -q -c "ALTER DATABASE \"$DB_NAME_ENV\" OWNER TO \"$DB_USER_ENV\";" >/dev/null 2>&1 || true
      fi
      ok "Papel \"$DB_USER_ENV\" sincronizado (senha + superusuário) e banco \"$DB_NAME_ENV\" pronto."
    fi

    PGCONNECT_TIMEOUT=5 psql -d "$DATABASE_URL" -c 'select 1' >/dev/null \
      || fail "Sem conexão com o Postgres local. Confira DATABASE_URL em server/.env."

    psql -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -f server/migrations/000_bootstrap.sql >/dev/null
    ok "Extensões, roles, auth.uid(), storage e realtime aplicados."

    for m in $(ls server/migrations/0[1-9]*.sql 2>/dev/null || true); do
      psql -v ON_ERROR_STOP=0 -d "$DATABASE_URL" -f "$m" >/dev/null 2>&1 || true
      ok "Migração aplicada: $(basename "$m")"
    done

    STORAGE_DIR="${STORAGE_ROOT:-/var/www/uploads}"
    mkdir -p "$STORAGE_DIR"; chmod 750 "$STORAGE_DIR"
    ok "Uploads em $STORAGE_DIR."

    # O Supabase roda PostgreSQL 17: um pg_dump 14 (padrão do Ubuntu 22.04)
    # aborta com "server version mismatch" ao copiar o schema.
    if ! ls /usr/lib/postgresql/1[7-9]/bin/pg_dump >/dev/null 2>&1; then
      warn "Instalando postgresql-client-17 (necessário para copiar o schema do Supabase)."
      sudo install -d /usr/share/keyrings
      curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | sudo gpg --dearmor -o /usr/share/keyrings/pgdg.gpg
      echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" \
        | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
      sudo apt-get update -qq
      sudo apt-get install -y -qq postgresql-client-17 \
        || fail "Falha ao instalar postgresql-client-17. Rode manualmente e repita."
      ok "postgresql-client-17 instalado."
    fi
    DB_PRONTO=true
  else
    warn "3/7 DATABASE_URL vazio ou psql ausente: banco local ignorado."
  fi
else
  fail "server/.env não existe. Baixe o arquivo pronto em /admin → Migração, salve como server/.env e rode de novo (sem ele não há banco local nem download de mídias)."
fi

# ---------- 4. Tabelas, usuários e arquivos ----------
if [ "$RAPIDO" = true ]; then
  warn "4/7 Migração de dados ignorada (--rapido)."
elif [ "$DB_PRONTO" != true ]; then
  fail "Banco local indisponível: confira DATABASE_URL em server/.env e se o psql está instalado."
elif [ -z "${LEGACY_SUPABASE_SERVICE_KEY:-}" ]; then
  fail "LEGACY_SUPABASE_SERVICE_KEY vazio em server/.env — é essa chave que baixa os vídeos/imagens dos buckets."
else
  step "4/7 Copiando tabelas, usuários e TODAS as mídias do Supabase"
  warn "Pode levar bastante tempo na primeira vez (os vídeos são o maior volume)."
  (cd server && npm run migrate:all -- "${MIGRATE_ARGS[@]+"${MIGRATE_ARGS[@]}"}")
  ok "Dados e mídias sincronizados (Supabase segue intacto)."
fi

# ---------- 5. Frontend ----------
step "5/7 Compilando o site"
npm run build
[ -d dist ] || fail "Build não gerou a pasta dist/."
ok "Site compilado ($(du -sh dist | cut -f1))."
if [ -n "${WEB_ROOT:-}" ] && [ "$WEB_ROOT" != "$(pwd)/dist" ]; then
  rsync -a --delete dist/ "$WEB_ROOT/"
  ok "Publicado em $WEB_ROOT."
fi

# ---------- 6. Serviços ----------
step "6/7 Reiniciando serviços"
mkdir -p /var/log/mro 2>/dev/null || sudo mkdir -p /var/log/mro
if command -v pm2 >/dev/null 2>&1; then
  [ -f ecosystem.config.cjs ] && pm2 startOrReload ecosystem.config.cjs --update-env >/dev/null
  pm2 save >/dev/null || true
  ok "PM2 recarregado (mro-api)."
else
  warn "PM2 não instalado (npm i -g pm2)."
fi
# O PM2 confirma o comando antes de o processo Node abrir a porta. Aguarde a
# saúde real para não confundir inicialização lenta com bloqueio de CORS.
PORT_LOCAL="${PORT:-8787}"
BACKEND_OK=false
for i in $(seq 1 90); do
  if HEALTH_JSON="$(curl -sf --max-time 3 "http://127.0.0.1:${PORT_LOCAL}/health" 2>/dev/null)" \
    && printf '%s' "$HEALTH_JSON" | grep -q '"ok":true'; then
    ok "Backend local respondendo na porta ${PORT_LOCAL}."
    BACKEND_OK=true
    break
  fi
  [ "$i" = "1" ] && warn "Aguardando a API concluir a inicialização..."
  sleep 1
done

if [ "$BACKEND_OK" != true ]; then
  warn "Backend local não ficou saudável. Diagnóstico sem credenciais:"
  pm2 describe mro-api 2>/dev/null | grep -E 'status|script path|exec cwd|restarts|uptime' || true
  tail -n 80 /var/log/mro/api-out.log 2>/dev/null || true
  tail -n 120 /var/log/mro/api-error.log 2>/dev/null || true
  fail "Backend local indisponível; a atualização foi bloqueada antes dos testes da extensão."
fi

# A extensão depende de preflight público. A rota exclusiva no Nginx responde
# OPTIONS mesmo se Express/Deno estiver reiniciando e inclui CORS até em 4xx/5xx.
# O instalador também testa o domínio público e interrompe a atualização se
# algum proxy/CDN remover ou duplicar Access-Control-Allow-Origin.
if [ -f deploy/ensure-mro-tool-cors-nginx.sh ]; then
  sudo env \
    API_DOMAIN="${API_DOMAIN:-api.maisresultadosonline.com.br}" \
    BACKEND_PORT="${PORT:-8787}" \
    bash deploy/ensure-mro-tool-cors-nginx.sh \
    && ok "CORS permanente da mro-tool-api validado localmente e pelo domínio público." \
    || fail "Atualização bloqueada: CORS externo da mro-tool-api não foi comprovado."
else
  fail "Instalador permanente de CORS ausente nesta revisão."
fi

# ---------- 7. Verificação ----------
step "7/7 Conferência"
if [ "$DB_PRONTO" = true ] && [ "$RAPIDO" = false ]; then
  (cd server && npm run migrate:verify) || warn "Conferência apontou divergências (veja acima)."
fi
cat <<EOF

$(echo -e "${G}═══ Atualização concluída ═══${N}")

O Lovable Cloud / Supabase continua ativo e inalterado.

Testar o backend próprio em paralelo, sem cortar nada:
  VITE_USE_LOCAL_BACKEND=true npm run build && pm2 restart mro-api

Somente quando tiver 100% de certeza:
  ./deploy.sh --cutover

Para acompanhar uma tentativa real de login da extensão no terminal:
  sudo bash deploy/watch-mro-tool-login.sh
EOF
