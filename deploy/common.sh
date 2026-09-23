#!/usr/bin/env bash
# Shared helpers for update-deploy.sh: output, docker compose per stack,
# .env reading and writing, HTTP probes. Sourced, never run on its own.

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '   \033[1;32m[ OK ]\033[0m %s\n' "$*"; }
warn() { printf '   \033[1;33m[WARN]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed"; }

# docker compose inside a stack's checkout, under that stack's project name.
compose() {
  if docker compose version >/dev/null 2>&1; then
    (cd "$STACK_DIR" && docker compose -p "$STACK_PROJECT" "$@")
  else
    (cd "$STACK_DIR" && docker-compose -p "$STACK_PROJECT" "$@")
  fi
}

# The container of a compose service (running or not), or "".
container_id() { compose ps -a -q "$1" 2>/dev/null | head -n 1; }

# "running", "exited", "created", "restarting"... or "missing".
container_state() {
  local id
  id="$(container_id "$1")"
  [ -n "$id" ] || { echo "missing"; return 0; }
  docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null || echo "missing"
}

# How many times Docker has restarted the container (a crash loop counts up).
container_restarts() {
  local id
  id="$(container_id "$1")"
  [ -n "$id" ] || { echo 0; return 0; }
  docker inspect -f '{{.RestartCount}}' "$id" 2>/dev/null || echo 0
}

# The first IPv4 address of a RUNNING container, or "" - never anything that
# is not an address, so a stopped container cannot leak "invalid" into nginx.
container_ip() {
  local id
  id="$(container_id "$1")"
  [ -n "$id" ] || return 0
  [ "$(container_state "$1")" = "running" ] || return 0
  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{"\n"}}{{end}}' "$id" 2>/dev/null | grep -E -m1 '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true
}

show_logs() {
  echo "   ---- last lines of 'docker compose -p $STACK_PROJECT logs $1' ----"
  compose logs --tail 40 --no-color "$1" 2>/dev/null | sed 's/^/   | /' || true
  echo "   ------------------------------------------------"
}

# HTTP status of a URL, "000" when nothing answered. curl prints 000 AND
# exits non-zero on a refused connection, so both are read as one "000".
http_status() {
  local code
  code="$(curl -k -s -o /dev/null -m 10 -w '%{http_code}' "$1" 2>/dev/null)" || true
  case "$code" in ''|000*) echo "000" ;; *) echo "$code" ;; esac
}

# A public URL tried a few times over: right after a restart nginx answers
# 502 until the container behind it is listening.
public_status() {
  local code
  for _ in $(seq 1 6); do
    code="$(http_status "$1")"
    case "$code" in 000|502|503|504) sleep 5 ;; *) break ;; esac
  done
  echo "$code"
}

# The value of KEY in a .env file (last active line wins), quotes and spaces trimmed, "" when absent.
env_value() {
  local file="$1" key="$2" line
  [ -f "$file" ] || return 0
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" | tail -n 1 | tr -d '\r')" || true
  [ -n "$line" ] || return 0
  line="${line#*=}"
  line="$(printf '%s' "$line" | sed -E "s/^[[:space:]]*//; s/[[:space:]]*$//; s/^\"(.*)\"$/\\1/; s/^'(.*)'$/\\1/")"
  printf '%s' "$line"
}

# Sets KEY=value in a .env file: the first active line for the key becomes
# the new value and is kept underneath as a comment, any other active line
# for the same key is commented out too (a leftover localhost or Atlas line),
# and a missing key is appended. Nothing is written when the value already
# matches, so the run is repeatable.
set_env_key() {
  local file="$1" key="$2" value="$3"
  [ "$(env_value "$file" "$key")" = "$value" ] && return 0
  CHANGED_ENV+=("$(basename "$(dirname "$file")")/$(basename "$file"): $key")
  [ "$DRY_RUN" = 1 ] && return 0
  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0; pattern = "^[[:space:]]*" key "[[:space:]]*=" }
    $0 ~ pattern && !done { print key "=" value; print "# previous: " $0; done = 1; next }
    $0 ~ pattern { print "# previous: " $0; next }
    { print }
    END { if (!done) print key "=" value }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

url_encode() {
  local text="$1" out="" i c
  for (( i = 0; i < ${#text}; i++ )); do
    c="${text:i:1}"
    case "$c" in
      [A-Za-z0-9.~_-]) out+="$c" ;;
      *) out+="$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
}

# "KEY: value" of the mongo service in a docker-compose.yml, quotes removed.
compose_value() {
  [ -f "$1" ] || return 0
  grep -E "^[[:space:]]*$2:" "$1" | head -n 1 | sed -E "s/^[^:]*:[[:space:]]*//; s/[[:space:]]*$//; s/^\"(.*)\"$/\\1/; s/^'(.*)'$/\\1/"
}

# host part of a Mongo connection string, credentials removed
mongo_host_of() {
  printf '%s' "$1" | sed -E 's#^[a-z+]+://##I; s#^[^@]*@##; s#[/?].*$##'
}

# The Mongo SERVER a connection string names, in a form two spellings of the
# same server share: ports dropped, an Atlas cluster reduced to its domain.
mongo_cluster_of() {
  mongo_host_of "$1" | tr ',' '\n' | sed -E 's/:[0-9]+$//' | awk -F. '{ if (NF >= 3) print $(NF-2) "." $(NF-1) "." $NF; else print $0 }' | sort -u | tr '\n' ' ' | sed -E 's/ $//'
}

same_mongo_server() {
  local a b word
  a="$(mongo_cluster_of "$1")"
  b="$(mongo_cluster_of "$2")"
  for word in $a; do
    case " $b " in *" $word "*) return 0 ;; esac
  done
  return 1
}

new_secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32; else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}
