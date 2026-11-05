#!/usr/bin/env bash
# ============================================================
# Clona a VPS ANTIGA inteira para esta VPS NOVA (Ubuntu 22.04/24.04).
# Rode NA VPS NOVA, como root:
#
#   curl -fsSL https://raw.githubusercontent.com/gabrielmaisresultadosonline/mro-remoix-04-09/main/deploy/clonar-vps.sh -o /root/clonar-vps.sh && bash /root/clonar-vps.sh IP_DA_VPS_ANTIGA
#
# Copia: banco PostgreSQL completo (todos os bancos, usuários e senhas),
# /var/www inteiro (site, server/.env, uploads, vídeos, ZIPs, galeria, lives),
# Nginx, certificados (Let's Encrypt e Cloudflare Origin), crontab e PM2.
# A VPS antiga NÃO é alterada (só leitura). Pode rodar de novo quantas
# vezes quiser: a cópia final, logo antes de trocar o IP no Cloudflare,
# substitui o banco da VPS nova pelos dados mais recentes.
# ============================================================
set -euo pipefail

OLD="${1:-}"
[ -n "$OLD" ] || { echo "Uso: bash clonar-vps.sh IP_DA_VPS_ANTIGA"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Rode como root (sudo -i)."; exit 1; }
SSH_USER="${SSH_USER:-root}"
SRC="$SSH_USER@$OLD"
log() { echo -e "\n\033[1;33m▶ $*\033[0m"; }

log "1/8 Acesso SSH à VPS antiga ($SRC)"
[ -f /root/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519 -q
if ! ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$SRC" true 2>/dev/null; then
  echo "Digite a senha root da VPS ANTIGA (só desta vez):"
  ssh-copy-id -o StrictHostKeyChecking=accept-new "$SRC"
fi
SSH="ssh -o StrictHostKeyChecking=accept-new $SRC"

log "2/8 Pacotes (PostgreSQL, Node 20, Deno, Nginx, PM2, ffmpeg)"
export DEBIAN_FRONTEND=noninteractive

# Ubuntu recém-instalado roda unattended-upgrades e trava o apt; esperar liberar
apt_wait() {
  local i
  for i in $(seq 1 60); do
    if ! fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock >/dev/null 2>&1; then
      return 0
    fi
    echo "aguardando apt liberar (unattended-upgrades em andamento)... ${i}/60"
    sleep 5
  done
  # última tentativa: mata o processo automático e repara
  systemctl stop unattended-upgrades apt-daily.service apt-daily-upgrade.service 2>/dev/null || true
  pkill -9 -f unattended-upgrade 2>/dev/null || true
  dpkg --configure -a || true
}

apt_wait
apt-get update -qq
apt_wait
apt-get install -y -qq curl ca-certificates gnupg lsb-release git rsync ufw nginx ffmpeg cron unzip \
  postgresql-common >/dev/null
OLD_PG="$($SSH "psql -V 2>/dev/null | grep -oE '[0-9]+' | head -1" || echo 16)"
OLD_PG_SERVER="$($SSH "sudo -u postgres psql -tAc 'show server_version_num' 2>/dev/null | cut -c1-2" || echo 16)"
PGV="${OLD_PG_SERVER:-16}"
if ! apt-cache show "postgresql-$PGV" >/dev/null 2>&1; then
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null
fi
apt_wait
apt-get install -y -qq "postgresql-$PGV" "postgresql-contrib-$PGV" "postgresql-$PGV-cron" >/dev/null || \
  apt-get install -y -qq "postgresql-$PGV" "postgresql-contrib-$PGV" >/dev/null
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt_wait
  apt-get install -y -qq nodejs >/dev/null
fi
command -v pm2 >/dev/null || npm i -g pm2 --silent
if ! command -v deno >/dev/null 2>&1; then
  command -v unzip >/dev/null || { apt_wait; apt-get install -y -qq unzip >/dev/null; }
  curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y >/dev/null
fi
command -v deno >/dev/null || { echo "ERRO: Deno não instalou. Rode: apt-get install -y unzip && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh"; exit 1; }
echo "PostgreSQL $PGV (antiga: servidor $PGV / cliente ${OLD_PG:-?})"

log "3/8 Configuração do PostgreSQL"
PG_CONF="/etc/postgresql/$PGV/main/postgresql.conf"
OLD_CONF="$($SSH "ls /etc/postgresql/*/main/postgresql.conf | head -1")"
for k in shared_preload_libraries cron.database_name max_connections shared_buffers work_mem; do
  line="$($SSH "grep -E '^\s*$k\s*=' $OLD_CONF | tail -1" || true)"
  [ -n "$line" ] && { sed -i "/^\s*${k//./\\.}\s*=/d" "$PG_CONF"; echo "$line" >> "$PG_CONF"; }
done
OLD_HBA="$($SSH "ls /etc/postgresql/*/main/pg_hba.conf | head -1")"
$SSH "cat $OLD_HBA" > "/etc/postgresql/$PGV/main/pg_hba.conf"
systemctl restart postgresql

log "4/8 Parando serviços desta VPS nova (para receber a cópia)"
pm2 kill >/dev/null 2>&1 || true

log "5/8 Copiando arquivos (/var/www, uploads, vídeos, Nginx, certificados)"
# keepalive evita queda em cópias longas; --partial + retry retomam de onde parou
SSHO="ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o TCPKeepAlive=yes"
RSYNC="rsync -aHAX --numeric-ids --delete --partial --timeout=120 --info=progress2 -e \"$SSHO\""
rsync_retry() { # rsync_retry <args...> — até 5 tentativas, retomando
  local tentativa
  for tentativa in 1 2 3 4 5; do
    if eval $RSYNC "$@"; then return 0; fi
    echo "⚠ conexão caiu na cópia (tentativa $tentativa/5) — retomando em 5s..."
    sleep 5
  done
  echo "ERRO: cópia falhou 5 vezes: $*"; return 1
}
rsync_retry --exclude node_modules "$SRC:/var/www/" /var/www/ || exit 1
for d in /etc/nginx /etc/letsencrypt /etc/ssl /var/cache/mro-deno /var/log/mro /var/backups/mro-nginx; do
  if $SSH "test -d $d"; then mkdir -p "$d"; rsync_retry "$SRC:$d/" "$d/" || exit 1; fi
done
$SSH "test -d /root/.pm2" && { mkdir -p /root/.pm2; eval rsync -a --partial -e "\"$SSHO\"" "$SRC:/root/.pm2/dump.pm2" /root/.pm2/ || true; }
$SSH "crontab -l 2>/dev/null" | crontab - || true

log "6/8 Banco de dados completo (todos os bancos, usuários e senhas)"
DBS="$(sudo -u postgres psql -tAc "select datname from pg_database where datname not in ('postgres','template0','template1')")"
for db in $DBS; do sudo -u postgres dropdb --if-exists "$db"; done
# baixa o dump para arquivo local com retry (conexão pode cair em bancos grandes)
DUMP_OK=0
for tentativa in 1 2 3; do
  if $SSH "sudo -u postgres pg_dumpall --clean --if-exists" > /tmp/clone-dump.sql; then DUMP_OK=1; break; fi
  echo "⚠ conexão caiu no dump do banco (tentativa $tentativa/3) — tentando de novo em 5s..."
  sleep 5
done
[ "$DUMP_OK" = 1 ] || { echo "ERRO: não consegui baixar o dump do banco. Rode o script de novo."; exit 1; }
sudo -u postgres psql -q -v ON_ERROR_STOP=0 -f /tmp/clone-dump.sql 2>/tmp/clone-db-erros.log || true
echo "Bancos copiados:"; sudo -u postgres psql -tAc "select datname, pg_size_pretty(pg_database_size(datname)) from pg_database where datname not like 'template%'"
grep -iE "error" /tmp/clone-db-erros.log | grep -viE "already exists|does not exist" | head -20 || true

log "7/8 Reinstalando dependências, compilando e subindo os serviços"
cd /var/www/ia-mro
git config --global --add safe.directory /var/www/ia-mro || true
chmod +x atualizar.sh
./atualizar.sh --rapido || echo "⚠ atualizar.sh avisou algo acima — confira."
for dir in /var/www/*/; do
  [ -f "$dir/package.json" ] && [ ! -d "$dir/node_modules" ] && [ "$dir" != "/var/www/ia-mro/" ] && \
    (cd "$dir" && npm install --omit=dev --silent || true)
done
[ -f /root/.pm2/dump.pm2 ] && pm2 resurrect || true
pm2 save >/dev/null || true
pm2 startup systemd -u root --hp /root >/dev/null || true
nginx -t && systemctl reload nginx
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

log "8/8 Conferência"
pm2 ls
NEW_IP="$(curl -fsS4 https://api.ipify.org || hostname -I | awk '{print $1}')"
echo "Arquivos /var/www antiga: $($SSH 'du -sh /var/www 2>/dev/null | cut -f1') | nova: $(du -sh /var/www | cut -f1)"
cat <<FIM

═══ Clone concluído ═══
IP desta VPS nova: $NEW_IP

Antes de trocar o domínio, teste sem mexer no Cloudflare:
  curl -k --resolve maisresultadosonline.com.br:443:127.0.0.1 https://maisresultadosonline.com.br -o /dev/null -w '%{http_code}\n'

Troca final (sem perder nada feito no meio tempo):
  1. Rode este mesmo comando de novo (copia o banco e os arquivos mais recentes).
  2. No Cloudflare → DNS, troque o IP de todos os registros A da antiga para $NEW_IP.
  3. Espere alguns dias funcionando antes de desligar a VPS antiga.
FIM
