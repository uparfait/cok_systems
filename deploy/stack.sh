#!/usr/bin/env bash
# One STACK is one environment: a branch of this folder, its own docker
# compose project (own network, own mongo, own volumes), its own set of .env
# files kept under deploy/env/<stack>/, and its own public hosts. Sourced by
# update-deploy.sh.

SERVICES=(frontend backend em-backend dc-backend)
# Values EVERY backend shares, whatever stack it belongs to: the mail
# account the system sends from. They are NOT in this repository - a
# password does not belong in git - but in deploy/env/shared.env on the
# server (git-ignored), or in an x-email block of docker-compose.yml, which
# is where the mongo credentials already live.
SHARED_KEYS=(EMAIL_HOST EMAIL_PORT EMAIL_USER EMAIL_PASS EMAIL_FROM)
declare -A PORT=([frontend]=5713 [backend]=2026 [em-backend]=2027 [dc-backend]=8765)
declare -A PROBE=([frontend]="/" [backend]="/cok/api/profile" [em-backend]="/health" [dc-backend]="/dcs/api/docs/")
declare -A LABEL=([frontend]="Frontend" [backend]="Main backend" [em-backend]="Event backend" [dc-backend]="DCS backend")
MONGO_SERVICE_HOST="mongo:27017"
WAIT_SECONDS="${WAIT_SECONDS:-240}"

# Fills the STACK_* globals for "ikaze" (production) or "uat-ikaze".
select_stack() {
  STACK="$1"
  STACK_DIR="$REPO_DIR"
  STACK_ENV_DIR="$ENV_STORE/$STACK"
  case "$STACK" in
    ikaze)
      STACK_BRANCH="$PROD_BRANCH"; STACK_PROJECT="$PROD_PROJECT"
      STACK_FRONT="$PROD_FRONT"; STACK_BACKEND_HOST="$PROD_BACKEND_HOST"; STACK_EVENTS_HOST="$PROD_EVENTS_HOST"; STACK_DCS_HOST="$PROD_DCS_HOST"
      STACK_SERVICES=(backend em-backend dc-backend frontend certbot) ;;
    uat-ikaze)
      STACK_BRANCH="$UAT_BRANCH"; STACK_PROJECT="$UAT_PROJECT"
      STACK_FRONT="$UAT_FRONT"; STACK_BACKEND_HOST="$UAT_BACKEND_HOST"; STACK_EVENTS_HOST="$UAT_EVENTS_HOST"; STACK_DCS_HOST="$UAT_DCS_HOST"
      STACK_SERVICES=(backend em-backend dc-backend frontend) ;;
    *) die "unknown stack '$STACK'" ;;
  esac
  declare -g -A IP=()
  NOT_ANSWERING=()
  CHANGED_ENV=()
}

current_branch() { git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?"; }

# A shared value: from deploy/env/shared.env if it is there, else from
# docker-compose.yml, else "" (and then whatever the stack's .env holds for
# that key is left alone).
shared_value() {
  local key="$1" value
  value="$(env_value "$ENV_STORE/shared.env" "$key")"
  [ -n "$value" ] || value="$(compose_value "$REPO_DIR/docker-compose.yml" "$key")"
  printf '%s' "$value"
}

# The folder on the stack's branch. Switching is what makes a stack build
# from its own code, so it happens even with --no-pull; only the pull is
# skipped then. Local edits to tracked files would block the switch, and
# are reported instead of being thrown away.
checkout_branch() {
  local branch="$1"
  [ "$(current_branch)" = "$branch" ] && return 0
  git -C "$REPO_DIR" checkout "$branch" 2>&1 | sed 's/^/   git: /' || true
  [ "$(current_branch)" = "$branch" ] || {
    git -C "$REPO_DIR" status --short | head -n 10 | sed 's/^/   /'
    die "could not switch $REPO_DIR to branch '$branch' - commit, stash or discard the local changes listed above, then run again"
  }
}

prepare_checkout() {
  log "Code of $STACK: branch $STACK_BRANCH"
  if [ "$DRY_RUN" = 1 ]; then
    ok "(dry run) folder is on '$(current_branch)'; a real run switches to '$STACK_BRANCH'$([ "$PULL" = 1 ] && printf ' and pulls' || true)"
    return 0
  fi
  if [ "$PULL" = 1 ]; then git -C "$REPO_DIR" fetch --all --prune 2>&1 | sed 's/^/   git: /' || warn "git fetch failed - continuing with what is on disk"; fi
  checkout_branch "$STACK_BRANCH"
  if [ "$PULL" = 1 ]; then
    if git -C "$REPO_DIR" pull --ff-only 2>&1 | sed 's/^/   git: /'; then ok "on branch $STACK_BRANCH, up to date"; else warn "git pull failed on $STACK_BRANCH - continuing with the code on disk"; fi
  else
    ok "on branch $STACK_BRANCH (no pull)"
  fi
}

# Each stack keeps its own .env files in deploy/env/<stack>/. A stack that
# has none yet starts from the files uploaded into the folder, then gets its
# own values (fix_env_files) before they are put in place (place_env_files).
ensure_stack_files() {
  local service store placed
  mkdir -p "$STACK_ENV_DIR"
  for service in "${ENV_SERVICES[@]}"; do
    store="$STACK_ENV_DIR/$service.env"
    placed="$REPO_DIR/$service/.env"
    # --fresh-env throws this stack's stored copy away and starts again
    # from the file uploaded into the folder. Everything the stack needs of
    # its own - its mongo lines, its origin, its JWT_SECRET, the shared mail
    # account - is written again below, so the only thing lost is a value
    # somebody set by hand in deploy/env/ and nowhere else.
    if [ -f "$store" ] && [ "${FRESH_ENV:-0}" = 1 ] && [ -f "$placed" ]; then
      if [ "$DRY_RUN" = 1 ]; then warn "(dry run) would start $STACK $service.env again from $service/.env"; continue; fi
      cp "$store" "$store.replaced.$STAMP"
      cp "$placed" "$store" && ok "$STACK $service.env started again from $service/.env (previous copy at $store.replaced.$STAMP)"
      continue
    fi
    [ -f "$store" ] && continue
    if [ -f "$placed" ]; then
      if [ "$DRY_RUN" = 1 ]; then warn "$STACK has no $service.env yet (a real run starts it from $service/.env)"; else cp "$placed" "$store" && ok "$STACK $service.env started from $service/.env"; fi
    else
      warn "$service/.env is missing and $STACK has no copy of its own - upload $service/.env and run again"
    fi
  done
}

# The stack's files copied into the places compose reads: <service>/.env.
place_env_files() {
  local service store
  [ "$DRY_RUN" = 1 ] && return 0
  for service in "${ENV_SERVICES[@]}"; do
    store="$STACK_ENV_DIR/$service.env"
    [ -f "$store" ] && cp "$store" "$REPO_DIR/$service/.env"
  done
  ok "$STACK .env files in place"
}

# Every database line on this stack's own mongo, this stack's own frontend
# host as the allowed origin, and one JWT_SECRET for its three backends -
# a different one from the other stack, so a token never crosses over.
fix_env_files() {
  local compose_file="$REPO_DIR/docker-compose.yml" user pass mongo_url secret other_secret other_stack service file backup origins key value missing=""
  user="$(compose_value "$compose_file" MONGO_INITDB_ROOT_USERNAME)"
  pass="$(compose_value "$compose_file" MONGO_INITDB_ROOT_PASSWORD)"
  if [ -z "$user" ] || [ -z "$pass" ]; then
    warn "$compose_file has no MONGO_INITDB_ROOT_USERNAME / PASSWORD - database lines are left as they are"
    return 0
  fi
  mongo_url="mongodb://$(url_encode "$user"):$(url_encode "$pass")@${MONGO_SERVICE_HOST}"
  origins="https://${STACK_FRONT}"
  if [ "$STACK" = "uat-ikaze" ]; then other_stack="ikaze"; else other_stack="uat-ikaze"; fi
  secret="$(env_value "$STACK_ENV_DIR/backend.env" JWT_SECRET)"
  other_secret="$(env_value "$ENV_STORE/$other_stack/backend.env" JWT_SECRET)"
  if [ -z "$secret" ] || [ "$secret" = "cok-jwt-secret-2026" ]; then
    secret="$(new_secret)"
    warn "$STACK gets a new JWT_SECRET (it was missing or the development default); everyone signed in on $STACK signs in again"
  elif [ -n "$other_secret" ] && [ "$secret" = "$other_secret" ]; then
    # The two stacks must not share a secret, and production keeps its own:
    # UAT is the one that changes, whichever stack is being processed.
    if [ "$STACK" = "uat-ikaze" ]; then
      secret="$(new_secret)"
      warn "uat-ikaze shared its JWT_SECRET with ikaze and gets a new one; everyone signed in on UAT signs in again"
    else
      other_secret="$(new_secret)"
      for service in "${ENV_SERVICES[@]}"; do
        [ -f "$ENV_STORE/uat-ikaze/$service.env" ] && set_env_key "$ENV_STORE/uat-ikaze/$service.env" JWT_SECRET "$other_secret"
      done
      warn "uat-ikaze shared its JWT_SECRET with ikaze and got a new one (production keeps its own); everyone signed in on UAT signs in again"
    fi
  fi
  for service in "${ENV_SERVICES[@]}"; do
    file="$STACK_ENV_DIR/$service.env"
    if [ ! -f "$file" ]; then
      warn "$STACK has no $service.env, so none of this stack's values - the mail account among them - reach that backend"
      continue
    fi
    backup="$file.bak.$STAMP"
    if [ "$DRY_RUN" = 0 ]; then
      cp "$file" "$backup"
      sed -i 's/\r$//' "$file"
    fi
    # The mail account is the same on all three, so it is written before
    # the lines that differ between them.
    for key in "${SHARED_KEYS[@]}"; do
      value="$(shared_value "$key")"
      [ -n "$value" ] && set_env_key "$file" "$key" "$value"
    done
    case "$service" in
      backend)
        set_env_key "$file" conne_string "${mongo_url}/cok?authSource=admin"
        set_env_key "$file" CLIENT_URL_SET "$origins"
        set_env_key "$file" JWT_SECRET "$secret" ;;
      em_backend)
        set_env_key "$file" DATABASE_URL2 "${mongo_url}/COK_EVENT_MNG?authSource=admin"
        set_env_key "$file" DATABASE_NAME2 "COK_EVENT_MNG"
        set_env_key "$file" COK_DB_NAME "cok"
        set_env_key "$file" CORS_ORIGIN "$origins"
        set_env_key "$file" FRONTEND_URL "$origins"
        set_env_key "$file" JWT_SECRET "$secret" ;;
      dc_backend)
        set_env_key "$file" conne_string "${mongo_url}/data_collection_system?authSource=admin"
        set_env_key "$file" COK_DB_NAME "cok"
        set_env_key "$file" CLIENT_URL_SET "$origins"
        set_env_key "$file" JWT_SECRET "$secret" ;;
    esac
    if [ "$DRY_RUN" = 0 ] && [ -f "$backup" ]; then
      if cmp -s "$file" "$backup"; then rm -f "$backup"; else ok "$STACK $service.env updated - previous copy at $backup"; fi
    fi
  done
  for key in "${SHARED_KEYS[@]}"; do
    [ -n "$(shared_value "$key")" ] || missing="$missing $key"
  done
  if [ -n "$missing" ]; then
    warn "no value for$missing - no backend of $STACK can send mail until they are set"
    printf '   These are kept OUT of git on purpose (a mail password must not be pushed),
'
    printf '   so they are written once per server. On this one, paste:

'
    printf '      cat > %s <<'"'"'EOF'"'"'
' "$ENV_STORE/shared.env"
    printf '      EMAIL_HOST=<host>
      EMAIL_PORT=587
      EMAIL_USER=<account>
      EMAIL_PASS=<password>
      EMAIL_FROM=<address>
'
    printf '      EOF

'
    printf '   then run this script again. An x-email block in docker-compose.yml is
'
    printf '   read too, but that file is pushed, so the password would go with it.
'
  fi
  if [ "${#CHANGED_ENV[@]}" -eq 0 ]; then ok "the $STACK .env files already carry this stack's values"; else printf '   set: %s\n' "${CHANGED_ENV[@]}"; fi
}

mongo_user() { compose_value "$REPO_DIR/docker-compose.yml" MONGO_INITDB_ROOT_USERNAME; }
mongo_pass() { compose_value "$REPO_DIR/docker-compose.yml" MONGO_INITDB_ROOT_PASSWORD; }

# Runs a mongosh script (stdin) against one database of this stack's mongo.
# The script goes in through --eval: fed on stdin, mongosh would echo its
# prompt and every line into the output.
mongo_run() {
  local script
  script="$(cat)"
  compose exec -T mongo mongosh --quiet -u "$(mongo_user)" -p "$(mongo_pass)" --authenticationDatabase admin "$1" --eval "$script"
}

# The services this stack BUILDS (certbot and mongo are pulled images).
buildable_services() {
  local service
  BUILDABLE=()
  for service in "${STACK_SERVICES[@]}"; do
    case " ${SERVICES[*]} " in *" $service "*) BUILDABLE+=("$service") ;; esac
  done
}

# NOTHING STALE IS REUSED.
#
# A container keeps the environment it was created with, and a build reuses
# any layer that looks unchanged - so "up -d --build" could run new code
# with the old .env, or skip the build altogether. Worse for the frontend,
# which bakes its .env INTO the bundle while it builds: a cached layer
# there meant a deployment that quietly kept the previous API addresses.
#
# So every deployment builds with NO CACHE and a fresh pull of the base
# images, then recreates every container (and the anonymous volumes inside
# them) so each one reads the .env files just put in place.
#
# The build comes FIRST and the swap second, deliberately: the old
# containers keep serving the site - and the page that asked for the
# deployment - while the new images are built, so the only downtime is the
# few seconds of the swap itself rather than the whole build.
#
# MONGO IS NEVER TOUCHED, and neither is any named volume: the databases,
# the uploaded files and the certificates are data, not cache.
start_stack() {
  log "Starting $STACK (project $STACK_PROJECT): mongo, then ${STACK_SERVICES[*]}"
  buildable_services
  if [ "$DRY_RUN" = 1 ]; then
    ok "(dry run) would run: docker compose -p $STACK_PROJECT up -d --no-deps --no-recreate mongo"
    if [ "$BUILD" = 1 ] && [ "${CLEAR_CACHE:-1}" = 1 ]; then
      ok "(dry run) would run: docker compose -p $STACK_PROJECT build --no-cache --pull ${BUILDABLE[*]}"
      ok "(dry run) would run: docker compose -p $STACK_PROJECT up -d --no-deps --force-recreate --renew-anon-volumes ${STACK_SERVICES[*]}"
    elif [ "$BUILD" = 1 ]; then
      ok "(dry run) would run: docker compose -p $STACK_PROJECT up -d --build --no-deps --force-recreate ${STACK_SERVICES[*]}"
    else
      ok "(dry run) would run: docker compose -p $STACK_PROJECT up -d --no-deps --force-recreate ${STACK_SERVICES[*]}"
    fi
    ok "(dry run) mongo, the named volumes (databases, uploads, certificates) and every other project are untouched"
    return 0
  fi
  compose up -d --no-deps --no-recreate mongo
  if [ "$BUILD" = 1 ] && [ "${CLEAR_CACHE:-1}" = 1 ]; then
    log "Building $STACK from nothing (no cache, base images pulled again) - the running site is untouched until it succeeds"
    compose build --no-cache --pull "${BUILDABLE[@]}"
    compose up -d --no-deps --force-recreate --renew-anon-volumes "${STACK_SERVICES[@]}"
  elif [ "$BUILD" = 1 ]; then
    compose up -d --build --no-deps --force-recreate "${STACK_SERVICES[@]}"
  else
    compose up -d --no-deps --force-recreate "${STACK_SERVICES[@]}"
  fi
}

# What the build left behind: images nothing points at any more and the
# builder's own cache. Both are rebuilt from the code whenever they are
# needed again, and a server that never drops them fills its disk - which
# is what stops mongo from starting at all. Named volumes and the images
# the running containers use are never candidates.
prune_build_leftovers() {
  log "Reclaiming the disk the old images and the build cache were using"
  if [ "$DRY_RUN" = 1 ]; then ok "(dry run) would run: docker image prune -f && docker builder prune -f"; return 0; fi
  docker image prune -f 2>&1 | tail -n 1 | sed 's/^/   /' || warn "could not prune the unused images"
  docker builder prune -f 2>&1 | tail -n 1 | sed 's/^/   /' || warn "could not prune the build cache"
}

ensure_running() {
  local service="$1" state
  state="$(container_state "$service")"
  [ "$state" = "running" ] && return 0
  warn "${LABEL[$service]} container is '$state' - starting it from scratch"
  [ "$state" = "missing" ] || show_logs "$service"
  if [ "$BUILD" = 1 ]; then compose up -d --build --no-deps --force-recreate "$service"; else compose up -d --no-deps --force-recreate "$service"; fi
  # A container recreated on its own must read the .env files too.
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
  log "Sign-in and mail settings of $STACK"
  local main_secret main_db name key value service lines file missing
  main_secret="$(env_value "$STACK_ENV_DIR/backend.env" JWT_SECRET)"
  main_db="$(env_value "$STACK_ENV_DIR/backend.env" conne_string)"
  for name in em_backend dc_backend; do
    value="$(env_value "$STACK_ENV_DIR/$name.env" JWT_SECRET)"
    if [ -z "$value" ] || [ "$value" != "$main_secret" ]; then warn "$name.env JWT_SECRET differs from backend.env - sign-in there fails with 'invalid signature'"; else ok "$name.env JWT_SECRET matches backend.env"; fi
    if [ "$name" = em_backend ]; then key=DATABASE_URL2; else key=conne_string; fi
    value="$(env_value "$STACK_ENV_DIR/$name.env" "$key")"
    if [ -n "$main_db" ] && ! same_mongo_server "$main_db" "$value"; then warn "$name.env $key does not reach the main backend's Mongo server - accounts will not be found"; else ok "$name.env $key reaches the same Mongo server as the main backend ($(mongo_cluster_of "$value"))"; fi
  done
  # THE MAIL ACCOUNT, per backend. One backend sending mail while another
  # cannot is nearly always this: the keys reached one .env and not the
  # other, and nothing said so until somebody noticed an email that never
  # arrived.
  for name in backend em_backend dc_backend; do
    file="$STACK_ENV_DIR/$name.env"
    if [ ! -f "$file" ]; then
      warn "$name.env is not in $STACK's store at all - it gets no mail account, no database line and no JWT_SECRET from this run"
      continue
    fi
    missing=""
    for key in "${SHARED_KEYS[@]}"; do
      [ -n "$(env_value "$file" "$key")" ] || missing="$missing $key"
    done
    if [ -n "$missing" ]; then warn "$name.env cannot send mail: no$missing"; else ok "$name.env carries the mail account ($(env_value "$file" EMAIL_USER) via $(env_value "$file" EMAIL_HOST))"; fi
  done
  for service in em-backend dc-backend; do
    lines="$(compose logs --tail 200 --no-color "$service" 2>/dev/null | grep -F "[AUTH CHECK]" | tail -n 4 | sed -E 's/^[^|]*\|[[:space:]]*//')" || true
    if [ -n "$lines" ]; then printf '   %s:\n' "${LABEL[$service]}"; printf '%s\n' "$lines" | sed 's/^/      /'; else warn "${LABEL[$service]} has not reported its [AUTH CHECK] lines yet"; fi
  done
}
