#!/usr/bin/env bash
# =============================================================================
# update-deploy.sh - one command to update the IKAZE deployment on the server.
#
#   sudo ./update-deploy.sh            pull, rebuild, restart, rewire nginx
#   sudo ./update-deploy.sh --no-pull  same, but keep the code as it is
#   sudo ./update-deploy.sh --no-build restart without rebuilding the images
#   sudo ./update-deploy.sh --dry-run  show the nginx file it would install
#
# What it does, in order:
#   1. pulls the latest code (unless --no-pull)
#   2. rebuilds and starts every Docker service EXCEPT mongo, which is
#      already running and is never touched
#   3. reads the private IP address Docker gave each container
#   4. regenerates /etc/nginx/sites-available/default from those addresses,
#      including the Data Collection System backend on dcms.kigalicity.gov.rw
#   5. tests the new nginx file, installs it and reloads nginx; the previous
#      file is kept as a timestamped backup and restored if the test fails
#   6. checks every public URL against its container and reports which to use
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_DEFAULT="/etc/nginx/sites-available/default"
SSL_CERT="/etc/nginx/certs/kigalicity.gov.rw.crt"
SSL_KEY="/etc/nginx/certs/kigalicity.gov.rw.key"

HOST_FRONTEND="ikaze.kigalicity.gov.rw"
HOST_FRONTEND_UAT="uat-ikaze.kigalicity.gov.rw"
HOST_BACKEND="uatps-ikaze.kigalicity.gov.rw"
HOST_EVENTS="uate-ikaze.kigalicity.gov.rw"
HOST_DCS="dcms.kigalicity.gov.rw"

# Docker Compose service -> internal port -> a path that answers without a login.
# Any HTTP status at all (even 401 or 404) proves the container is up.
SERVICES=(frontend backend em-backend dc-backend)
declare -A PORT=([frontend]=5713 [backend]=2026 [em-backend]=2027 [dc-backend]=8765)
declare -A PROBE=([frontend]="/" [backend]="/cok/api/profile" [em-backend]="/health" [dc-backend]="/dcs/api/docs/")
declare -A LABEL=([frontend]="Frontend" [backend]="Main backend" [em-backend]="Event backend" [dc-backend]="DCS backend")
STARTED_SERVICES=(backend em-backend dc-backend frontend certbot)

PULL=1
BUILD=1
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    --no-build) BUILD=0 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '   \033[1;32m[ OK ]\033[0m %s\n' "$*"; }
warn() { printf '   \033[1;33m[WARN]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed"; }

compose() {
  if docker compose version >/dev/null 2>&1; then docker compose "$@"; else docker-compose "$@"; fi
}

# The first IPv4 address of a compose service's container, or "" when it has none yet.
container_ip() {
  local id
  id="$(compose ps -q "$1" 2>/dev/null | head -n 1)"
  [ -n "$id" ] || return 0
  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$id" 2>/dev/null | awk '{print $1}'
}

# HTTP status of a URL, "000" when nothing answered.
http_status() { curl -k -s -o /dev/null -m 10 -w '%{http_code}' "$1" 2>/dev/null || echo "000"; }

# ------------------------------------------------------------------ preflight
[ "$DRY_RUN" = 1 ] || [ "$(id -u)" = 0 ] || die "run with sudo: it writes $NGINX_DEFAULT and reloads nginx"
need_cmd docker
need_cmd curl
[ "$DRY_RUN" = 1 ] || need_cmd nginx
cd "$REPO_DIR"
[ -f docker-compose.yml ] || die "docker-compose.yml not found in $REPO_DIR"

# ------------------------------------------------------------------ 1. code
if [ "$PULL" = 1 ] && [ -d .git ]; then
  log "Pulling the latest code"
  if git pull --ff-only; then ok "code is up to date"; else warn "git pull failed - continuing with the code already on disk"; fi
fi

# ------------------------------------------------------------------ 2. docker
log "Checking MongoDB (left untouched)"
if [ -n "$(compose ps -q mongo 2>/dev/null)" ] && [ "$(compose ps --status running -q mongo 2>/dev/null | wc -l)" -gt 0 ]; then
  ok "mongo container is running"
else
  warn "no running compose 'mongo' container found - the backends must reach the database named in their .env files"
fi

if [ "$DRY_RUN" = 0 ]; then
  log "Starting services without mongo: ${STARTED_SERVICES[*]}"
  if [ "$BUILD" = 1 ]; then
    compose up -d --build --no-deps "${STARTED_SERVICES[@]}"
  else
    compose up -d --no-deps "${STARTED_SERVICES[@]}"
  fi
fi

# ------------------------------------------------------------------ 3. addresses
log "Reading container addresses"
declare -A IP
for service in "${SERVICES[@]}"; do
  ip=""
  for _ in $(seq 1 30); do
    ip="$(container_ip "$service")"
    [ -n "$ip" ] && break
    sleep 2
  done
  [ -n "$ip" ] || die "no container address for '$service' - is it running? (docker compose ps)"
  IP[$service]="$ip"
  ok "${LABEL[$service]} -> $ip:${PORT[$service]}"
done

log "Waiting for the containers to answer"
for service in "${SERVICES[@]}"; do
  status="000"
  for _ in $(seq 1 30); do
    status="$(http_status "http://${IP[$service]}:${PORT[$service]}${PROBE[$service]}")"
    [ "$status" != "000" ] && break
    sleep 2
  done
  if [ "$status" != "000" ]; then ok "${LABEL[$service]} answers (HTTP $status)"; else warn "${LABEL[$service]} is not answering yet at ${IP[$service]}:${PORT[$service]}"; fi
done

# ------------------------------------------------------------------ 4. nginx file
ssl_block() {
  cat <<EOF
    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
EOF
}

# A frontend host: the React app plus the APIs it proxies itself; WebSocket
# upgrade for socket.io; long read timeout for data exports and feeds.
frontend_server() {
  cat <<EOF
# Frontend application (container frontend, port ${PORT[frontend]})
server {
    listen 443 ssl http2;
    server_name $1;

$(ssl_block)

    client_max_body_size 100m;

    location / {
        proxy_pass http://${IP[frontend]}:${PORT[frontend]};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}

EOF
}

# A backend host: the API served directly on its own domain.
backend_server() {
  local host="$1" service="$2" read_timeout="$3"
  cat <<EOF
# ${LABEL[$service]} (container ${service}, port ${PORT[$service]})
server {
    listen 443 ssl http2;
    server_name ${host};

$(ssl_block)

    client_max_body_size 100m;

    location / {
        proxy_pass http://${IP[$service]}:${PORT[$service]};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout ${read_timeout};
        proxy_read_timeout ${read_timeout};
    }
}

EOF
}

render_nginx() {
  cat <<EOF
# Generated by update-deploy.sh on $(date '+%Y-%m-%d %H:%M:%S') - do not edit by hand,
# run the script again after the containers restart (their addresses change).

server {
    listen 80;
    server_name ${HOST_FRONTEND} ${HOST_FRONTEND_UAT} ${HOST_BACKEND} ${HOST_EVENTS} ${HOST_DCS};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

EOF
  frontend_server "$HOST_FRONTEND"
  frontend_server "$HOST_FRONTEND_UAT"
  backend_server "$HOST_BACKEND" backend 60s
  backend_server "$HOST_EVENTS" em-backend 60s
  backend_server "$HOST_DCS" dc-backend 600s
}

log "Generating the nginx configuration"
NEW_FILE="$(mktemp)"
render_nginx > "$NEW_FILE"

if [ "$DRY_RUN" = 1 ]; then
  cat "$NEW_FILE"
  rm -f "$NEW_FILE"
  exit 0
fi

if [ -f "$NGINX_DEFAULT" ] && cmp -s "$NEW_FILE" "$NGINX_DEFAULT"; then
  ok "nginx configuration already matches - nothing to change"
  rm -f "$NEW_FILE"
else
  BACKUP="${NGINX_DEFAULT}.bak.$(date '+%Y%m%d-%H%M%S')"
  [ -f "$NGINX_DEFAULT" ] && cp "$NGINX_DEFAULT" "$BACKUP" && ok "previous file kept at $BACKUP"
  install -m 644 "$NEW_FILE" "$NGINX_DEFAULT"
  rm -f "$NEW_FILE"
  [ -e /etc/nginx/sites-enabled/default ] || ln -s "$NGINX_DEFAULT" /etc/nginx/sites-enabled/default
  if nginx -t; then
    if systemctl reload nginx 2>/dev/null || nginx -s reload; then ok "nginx reloaded"; else die "nginx could not be reloaded"; fi
  else
    if [ -n "${BACKUP:-}" ] && [ -f "$BACKUP" ]; then cp "$BACKUP" "$NGINX_DEFAULT"; fi
    die "the generated nginx file failed 'nginx -t' - the previous file was restored"
  fi
fi

# ------------------------------------------------------------------ 6. verify
log "Checking every public address"
declare -A URL=([frontend]="https://${HOST_FRONTEND}" [backend]="https://${HOST_BACKEND}" [em-backend]="https://${HOST_EVENTS}" [dc-backend]="https://${HOST_DCS}")
printf '   %-14s %-22s %-8s %-8s %s\n' "SERVICE" "CONTAINER" "DIRECT" "URL" "RESULT"
for service in "${SERVICES[@]}"; do
  direct="$(http_status "http://${IP[$service]}:${PORT[$service]}${PROBE[$service]}")"
  public="$(http_status "${URL[$service]}${PROBE[$service]}")"
  if [ "$public" != "000" ] && [ "$public" != "502" ] && [ "$public" != "504" ]; then
    result="OK - ${URL[$service]}"
  elif [ "$direct" != "000" ]; then
    result="URL not reachable (DNS or certificate) - use http://${IP[$service]}:${PORT[$service]} meanwhile"
  else
    result="container not answering - docker compose logs ${service}"
  fi
  printf '   %-14s %-22s %-8s %-8s %s\n' "$service" "${IP[$service]}:${PORT[$service]}" "$direct" "$public" "$result"
done
uat="$(http_status "https://${HOST_FRONTEND_UAT}/")"
printf '   %-14s %-22s %-8s %-8s %s\n' "frontend-uat" "${IP[frontend]}:${PORT[frontend]}" "-" "$uat" "https://${HOST_FRONTEND_UAT}"

log "Done"
echo "   Container addresses change whenever a container is recreated: run this script again after any restart."
