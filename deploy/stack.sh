#!/usr/bin/env bash
# One STACK is one environment: a git checkout on its own branch, its own
# docker compose project (own network, own mongo, own volumes), its own
# .env files and its own public hosts. Sourced by update-deploy.sh.

SERVICES=(frontend backend em-backend dc-backend)
declare -A PORT=([frontend]=5713 [backend]=2026 [em-backend]=2027 [dc-backend]=8765)
declare -A PROBE=([frontend]="/" [backend]="/cok/api/profile" [em-backend]="/health" [dc-backend]="/dcs/api/docs/")
declare -A LABEL=([frontend]="Frontend" [backend]="Main backend" [em-backend]="Event backend" [dc-backend]="DCS backend")
MONGO_SERVICE_HOST="mongo:27017"
WAIT_SECONDS="${WAIT_SECONDS:-240}"

# Fills the STACK_* globals for "ikaze" (production) or "uat-ikaze".
select_stack() {
  STACK="$1"
  case "$STACK" in
    ikaze)
      STACK_DIR="$PROD_DIR"; STACK_BRANCH="$PROD_BRANCH"; STACK_PROJECT="$PROD_PROJECT"
      STACK_FRONT="$PROD_FRONT"; STACK_BACKEND_HOST="$PROD_BACKEND_HOST"; STACK_EVENTS_HOST="$PROD_EVENTS_HOST"; STACK_DCS_HOST="$PROD_DCS_HOST"
      STACK_SERVICES=(backend em-backend dc-backend frontend certbot) ;;
    uat-ikaze)
      STACK_DIR="$UAT_DIR"; STACK_BRANCH="$UAT_BRANCH"; STACK_PROJECT="$UAT_PROJECT"
      STACK_FRONT="$UAT_FRONT"; STACK_BACKEND_HOST="$UAT_BACKEND_HOST"; STACK_EVENTS_HOST="$UAT_EVENTS_HOST"; STACK_DCS_HOST="$UAT_DCS_HOST"
      STACK_SERVICES=(backend em-backend dc-backend frontend) ;;
    *) die "unknown stack '$STACK'" ;;
  esac
  declare -g -A IP=()
  NOT_ANSWERING=()
  CHANGED_ENV=()
}

# The checkout on its branch, cloned the first time it is missing.
prepare_checkout() {
  if [ ! -d "$STACK_DIR/.git" ]; then
    [ "$DRY_RUN" = 1 ] && { warn "$STACK_DIR does not exist yet (a real run clones branch $STACK_BRANCH there)"; return 0; }
    local remote
    remote="$(git -C "$PROD_DIR" remote get-url origin)"
    log "Cloning branch $STACK_BRANCH into $STACK_DIR"
    git clone --branch "$STACK_BRANCH" "$remote" "$STACK_DIR" || die "could not clone $remote (branch $STACK_BRANCH)"
  fi
  [ "$PULL" = 1 ] || return 0
  log "Updating $STACK_DIR to branch $STACK_BRANCH"
  [ "$DRY_RUN" = 1 ] && { ok "(dry run) would fetch, checkout $STACK_BRANCH and pull"; return 0; }
  git -C "$STACK_DIR" fetch --all --prune || warn "git fetch failed - continuing with what is on disk"
  if git -C "$STACK_DIR" checkout "$STACK_BRANCH" 2>/dev/null; then
    if git -C "$STACK_DIR" pull --ff-only; then ok "on branch $STACK_BRANCH, up to date"; else warn "git pull failed on $STACK_BRANCH - continuing with the code on disk"; fi
  else
    warn "branch $STACK_BRANCH is not available in $STACK_DIR - continuing on $(git -C "$STACK_DIR" rev-parse --abbrev-ref HEAD)"
  fi
}

# docker-compose.yml and the three .env files never come through git: a new
# stack starts from copies of the production ones, then gets its own values.
ensure_stack_files() {
  local file
  for file in docker-compose.yml backend/.env em_backend/.env dc_backend/.env; do
    [ -f "$STACK_DIR/$file" ] && continue
    if [ -f "$PROD_DIR/$file" ]; then
      if [ "$DRY_RUN" = 1 ]; then warn "$STACK_DIR/$file is missing (a real run copies it from $PROD_DIR)"; else cp "$PROD_DIR/$file" "$STACK_DIR/$file" && ok "$file copied from the production checkout"; fi
    else
      warn "$file is missing in $STACK_DIR and in $PROD_DIR - upload it"
    fi
  done
}

# Every database line on this stack's own mongo, this stack's own frontend
# host as the allowed origin, and one JWT_SECRET for its three backends -
# a different one from the other stack, so a token never crosses over.
fix_env_files() {
  local compose_file="$STACK_DIR/docker-compose.yml" user pass mongo_url secret other_secret file backup origins
  user="$(compose_value "$compose_file" MONGO_INITDB_ROOT_USERNAME)"
  pass="$(compose_value "$compose_file" MONGO_INITDB_ROOT_PASSWORD)"
  if [ -z "$user" ] || [ -z "$pass" ]; then
    warn "$compose_file has no MONGO_INITDB_ROOT_USERNAME / PASSWORD - database lines are left as they are"
    return 0
  fi
  mongo_url="mongodb://$(url_encode "$user"):$(url_encode "$pass")@${MONGO_SERVICE_HOST}"
  origins="https://${STACK_FRONT}"
  secret="$(env_value "$STACK_DIR/backend/.env" JWT_SECRET)"
  if [ "$STACK" = "uat-ikaze" ]; then other_secret="$(env_value "$PROD_DIR/backend/.env" JWT_SECRET)"; else other_secret="$(env_value "$UAT_DIR/backend/.env" JWT_SECRET)"; fi
  if [ -z "$secret" ] || [ "$secret" = "cok-jwt-secret-2026" ] || { [ -n "$other_secret" ] && [ "$secret" = "$other_secret" ]; }; then
    secret="$(new_secret)"
    warn "$STACK gets a new JWT_SECRET of its own (it was missing, the development default, or shared with the other stack); everyone signed in here must sign in again"
  fi
  for file in backend/.env em_backend/.env dc_backend/.env; do
    [ -f "$STACK_DIR/$file" ] || continue
    backup="$STACK_DIR/$file.bak.$STAMP"
    if [ "$DRY_RUN" = 0 ]; then
      cp "$STACK_DIR/$file" "$backup"
      sed -i 's/\r$//' "$STACK_DIR/$file"
    fi
    case "$file" in
      backend/.env)
        set_env_key "$STACK_DIR/$file" conne_string "${mongo_url}/cok?authSource=admin"
        set_env_key "$STACK_DIR/$file" CLIENT_URL_SET "$origins"
        set_env_key "$STACK_DIR/$file" JWT_SECRET "$secret" ;;
      em_backend/.env)
        set_env_key "$STACK_DIR/$file" DATABASE_URL2 "${mongo_url}/COK_EVENT_MNG?authSource=admin"
        set_env_key "$STACK_DIR/$file" DATABASE_NAME2 "COK_EVENT_MNG"
        set_env_key "$STACK_DIR/$file" COK_DB_NAME "cok"
        set_env_key "$STACK_DIR/$file" CORS_ORIGIN "$origins"
        set_env_key "$STACK_DIR/$file" FRONTEND_URL "$origins"
        set_env_key "$STACK_DIR/$file" JWT_SECRET "$secret" ;;
      dc_backend/.env)
        set_env_key "$STACK_DIR/$file" conne_string "${mongo_url}/data_collection_system?authSource=admin"
        set_env_key "$STACK_DIR/$file" COK_DB_NAME "cok"
        set_env_key "$STACK_DIR/$file" CLIENT_URL_SET "$origins"
        set_env_key "$STACK_DIR/$file" JWT_SECRET "$secret" ;;
    esac
    if [ "$DRY_RUN" = 0 ] && [ -f "$backup" ]; then
      if cmp -s "$STACK_DIR/$file" "$backup"; then rm -f "$backup"; else ok "$file updated - previous copy at $backup"; fi
    fi
  done
  if [ "${#CHANGED_ENV[@]}" -eq 0 ]; then ok "the .env files already carry this stack's values"; else printf '   set: %s\n' "${CHANGED_ENV[@]}"; fi
}

mongo_user() { compose_value "$STACK_DIR/docker-compose.yml" MONGO_INITDB_ROOT_USERNAME; }
mongo_pass() { compose_value "$STACK_DIR/docker-compose.yml" MONGO_INITDB_ROOT_PASSWORD; }

# Runs a mongosh script (stdin) against one database of this stack's mongo.
mongo_run() {
  compose exec -T mongo mongosh --quiet -u "$(mongo_user)" -p "$(mongo_pass)" --authenticationDatabase admin "$1"
}

start_stack() {
  log "Starting $STACK: mongo, then ${STACK_SERVICES[*]}"
  [ "$DRY_RUN" = 1 ] && return 0
  compose up -d --no-deps --no-recreate mongo
  if [ "$BUILD" = 1 ]; then compose up -d --build --no-deps "${STACK_SERVICES[@]}"; else compose up -d --no-deps "${STACK_SERVICES[@]}"; fi
}

ensure_running() {
  local service="$1" state
  state="$(container_state "$service")"
  [ "$state" = "running" ] && return 0
  warn "${LABEL[$service]} container is '$state' - starting it from scratch"
  [ "$state" = "missing" ] || show_logs "$service"
  if [ "$BUILD" = 1 ]; then compose up -d --build --no-deps --force-recreate "$service"; else compose up -d --no-deps --force-recreate "$service"; fi
}

read_addresses() {
  log "Reading $STACK container addresses"
  local service ip round
  for service in "${SERVICES[@]}"; do
    ip=""
    for round in 1 2; do
      for _ in $(seq 1 15); do
        ip="$(container_ip "$service")"
        [ -n "$ip" ] && break
        [ "$DRY_RUN" = 1 ] && break
        sleep 2
      done
      [ -n "$ip" ] && break
      if [ "$round" = 1 ] && [ "$DRY_RUN" = 0 ]; then ensure_running "$service"; fi
    done
    if [ -z "$ip" ]; then
      [ "$DRY_RUN" = 1 ] && { warn "${LABEL[$service]} is not running (dry run continues with a placeholder address)"; IP[$service]="0.0.0.0"; continue; }
      warn "${LABEL[$service]} has no running container (state: $(container_state "$service"))"
      show_logs "$service"
      die "'$service' of $STACK could not be started - fix the cause shown above, then run again"
    fi
    IP[$service]="$ip"
    ok "${LABEL[$service]} -> $ip:${PORT[$service]}"
  done
}

# The addresses again, without waiting or failing: for the final checks.
refresh_addresses() {
  local service ip
  for service in "${SERVICES[@]}"; do
    ip="$(container_ip "$service")"
    IP[$service]="${ip:-0.0.0.0}"
  done
}

wait_for_answers() {
  log "Waiting for $STACK containers to answer (up to ${WAIT_SECONDS}s each)"
  local service status waited restarts_before gave_up
  for service in "${SERVICES[@]}"; do
    status="000"; waited=0; gave_up=""
    restarts_before="$(container_restarts "$service")"
    printf '   %s ' "${LABEL[$service]}"
    while :; do
      status="$(http_status "http://${IP[$service]}:${PORT[$service]}${PROBE[$service]}")"
      [ "$status" != "000" ] && break
      [ "$waited" -ge "$WAIT_SECONDS" ] && break
      [ "$DRY_RUN" = 1 ] && break
      if [ "$(container_state "$service")" != "running" ] || [ "$(container_restarts "$service")" != "$restarts_before" ]; then gave_up="crashed"; break; fi
      printf '.'
      sleep 3
      waited=$((waited + 3))
      if [ $((waited % 30)) -eq 0 ]; then
        printf '\n'
        compose logs --tail 3 --no-color "$service" 2>/dev/null | sed 's/^/      log: /' || true
        printf '   %s ' "${LABEL[$service]}"
      fi
    done
    printf '\n'
    if [ "$status" != "000" ]; then
      ok "${LABEL[$service]} answers (HTTP $status after ${waited}s)"
    else
      if [ "$gave_up" = "crashed" ]; then warn "${LABEL[$service]} keeps crashing and being restarted by Docker (state: $(container_state "$service"))"; else warn "${LABEL[$service]} is not answering at ${IP[$service]}:${PORT[$service]} after ${WAIT_SECONDS}s"; fi
      NOT_ANSWERING+=("$service")
      show_logs "$service"
    fi
  done
}

# The two verifying backends compared with the main one, and what they
# themselves reported at startup ([AUTH CHECK] lines).
check_sign_in() {
  log "Sign-in settings of $STACK"
  local main_secret main_db name key value service lines
  main_secret="$(env_value "$STACK_DIR/backend/.env" JWT_SECRET)"
  main_db="$(env_value "$STACK_DIR/backend/.env" conne_string)"
  for name in em_backend dc_backend; do
    value="$(env_value "$STACK_DIR/$name/.env" JWT_SECRET)"
    if [ -z "$value" ] || [ "$value" != "$main_secret" ]; then warn "$name/.env JWT_SECRET differs from backend/.env - sign-in there fails with 'invalid signature'"; else ok "$name/.env JWT_SECRET matches backend/.env"; fi
    if [ "$name" = em_backend ]; then key=DATABASE_URL2; else key=conne_string; fi
    value="$(env_value "$STACK_DIR/$name/.env" "$key")"
    if [ -n "$main_db" ] && ! same_mongo_server "$main_db" "$value"; then warn "$name/.env $key does not reach the main backend's Mongo server - accounts will not be found"; else ok "$name/.env $key reaches the same Mongo server as the main backend ($(mongo_cluster_of "$value"))"; fi
  done
  for service in em-backend dc-backend; do
    lines="$(compose logs --tail 200 --no-color "$service" 2>/dev/null | grep -F "[AUTH CHECK]" | tail -n 4 | sed -E 's/^[^|]*\|[[:space:]]*//')" || true
    if [ -n "$lines" ]; then printf '   %s:\n' "${LABEL[$service]}"; printf '%s\n' "$lines" | sed 's/^/      /'; else warn "${LABEL[$service]} has not reported its [AUTH CHECK] lines yet"; fi
  done
}
