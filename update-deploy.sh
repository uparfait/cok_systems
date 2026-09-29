#!/usr/bin/env bash
# =============================================================================
# update-deploy.sh - one command to update the IKAZE deployments on the server.
#
# Two STACKS run side by side, both built from THIS folder, each from its
# own branch. Each is a separate Docker Compose project with its own network,
# containers, mongo and volumes, its own set of .env files and its own public
# hosts, so nothing of one can touch the other:
#
#   uat-ikaze  acceptance   branch "uat"     project cok-systems        (the database collected so far)
#   ikaze      production   branch "ikaze"   project cok-systems-ikaze  (starts with an empty database)
#
#   sudo ./update-deploy.sh                  both stacks (UAT first), same as --all
#   sudo ./update-deploy.sh --ikaze          production only
#   sudo ./update-deploy.sh --uat-ikaze      UAT only
#   options: --no-pull  --no-build  --keep-env  --keep-cache  --fresh-env  --dry-run
#
# EVERY DEPLOYMENT STARTS FROM NOTHING. The images are built with no cache
# and a fresh pull of their base images, and every container is recreated
# with the anonymous volumes inside it thrown away, so nothing that was
# cached in a layer or baked into a container survives - the frontend in
# particular bakes its .env into its bundle while it builds, and a cached
# layer there used to keep the previous API addresses. The build runs
# BEFORE the swap, so the site stays up while it builds.
#   --keep-cache  the old, faster behaviour: reuse layers, build only what
#                 changed. For a quick iteration, never for a release.
#   --fresh-env   throw away the stack's stored .env files and start them
#                 again from the ones uploaded into the folder.
#
# MONGO AND EVERY NAMED VOLUME ARE LEFT ALONE: the databases, the uploaded
# files and the certificates are data, not cache. Only the service
# containers, their images and the build cache are cleared.
#
#   --admin-email=<email>  says production is being created for the FIRST
#       time: that person is looked up in the UAT accounts and copied into
#       production (account, role, department, activated) without asking,
#       unless an account with that email already exists there.
#       Without it, the copy is only offered when production has no account.
#
# Databases are never deleted by this script.
#
# For each stack, in order:
#   1. the folder is switched to the stack's branch and pulled
#   2. the stack's .env files (deploy/env/<stack>/, started from the uploaded
#      <service>/.env files the first time) are given the stack's own values -
#      every database line on the stack's own mongo (credentials from
#      docker-compose.yml), its frontend host as the allowed browser origin,
#      one JWT_SECRET for its three backends that differs from the other
#      stack's - and copied into place
#   3. mongo is started if needed; the services are built from nothing and
#      every container is recreated, so each reads the .env just placed
#   4. container addresses are read, every container is waited for, the
#      sign-in settings are checked and the backends' own report is shown
#   5. production only: the first user is copied from UAT (see --admin-email)
#   6. the stack's nginx file is written from the container addresses
# Then nginx is tested and restarted once, the images and build cache left
# over are dropped, every public URL is verified, and the folder is left on
# the production branch with production's .env files.
#
# The mail account every backend sends from is written into all three .env
# files of every stack from deploy/env/shared.env (git-ignored: one copy per
# server) or from an x-email block of docker-compose.yml.
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$REPO_DIR/deploy/common.sh"
source "$REPO_DIR/deploy/config.sh"
source "$REPO_DIR/deploy/stack.sh"
source "$REPO_DIR/deploy/nginx.sh"
source "$REPO_DIR/deploy/seed_admin.sh"

PULL=1
BUILD=1
DRY_RUN=0
FIX_ENV=1
# Clearing everything cached is the DEFAULT: a deployment that reuses a
# layer or keeps a container is the reason a release can go out carrying
# the previous .env.
CLEAR_CACHE=1
FRESH_ENV=0
ADMIN_EMAIL=""
STAMP="$(date '+%Y%m%d-%H%M%S')"
STACKS=()
STARTED_WORK=0

# Everything between the two rules at the top of this file, so the help
# can never again stop halfway through it.
usage() { sed -n '3,/^# =\{20,\}$/p' "$0" | sed '$d'; }

parse_args() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --all) STACKS=(uat-ikaze ikaze) ;;
      --ikaze) STACKS+=(ikaze) ;;
      --uat-ikaze) STACKS+=(uat-ikaze) ;;
      --no-pull) PULL=0 ;;
      --no-build) BUILD=0 ;;
      --keep-env) FIX_ENV=0 ;;
      --keep-cache) CLEAR_CACHE=0 ;;
      --fresh-env) FRESH_ENV=1 ;;
      --dry-run) DRY_RUN=1 ;;
      --admin-email=*) ADMIN_EMAIL="${arg#*=}" ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
    esac
  done
  [ "${#STACKS[@]}" -gt 0 ] || STACKS=(uat-ikaze ikaze)
}

preflight() {
  [ "$DRY_RUN" = 1 ] || [ "$(id -u)" = 0 ] || die "run with sudo: it writes $NGINX_DIR and restarts nginx"
  need_cmd docker
  need_cmd curl
  need_cmd git
  [ "$DRY_RUN" = 1 ] || need_cmd nginx
  [ -f "$REPO_DIR/docker-compose.yml" ] || die "docker-compose.yml not found in $REPO_DIR"
  [ -d "$REPO_DIR/.git" ] || die "$REPO_DIR is not a git checkout"
}

# The folder's resting state is production: its branch checked out and its
# .env files in place, whatever was deployed last. Runs at the end, and also
# when the script stops early.
restore_production() {
  [ "$DRY_RUN" = 0 ] && [ "$STARTED_WORK" = 1 ] || return 0
  select_stack ikaze
  if [ "$(current_branch)" != "$PROD_BRANCH" ]; then
    if git -C "$REPO_DIR" checkout "$PROD_BRANCH" >/dev/null 2>&1; then ok "folder back on branch $PROD_BRANCH"; else warn "could not switch the folder back to branch $PROD_BRANCH"; fi
  fi
  place_env_files >/dev/null 2>&1 || true
}

# Containers of a project no stack uses any more are stopped and removed so
# they do not keep running beside the real stacks. Volumes are kept.
retire_legacy_projects() {
  local project
  for project in "${LEGACY_PROJECTS[@]}"; do
    [ -n "$(docker ps -a -q --filter "label=com.docker.compose.project=$project" 2>/dev/null)" ] || continue
    log "Retiring old compose project '$project' (containers and network only; volumes are kept)"
    if [ "$DRY_RUN" = 1 ]; then ok "(dry run) would run: docker compose -p $project down"; continue; fi
    (cd "$REPO_DIR" && docker compose -p "$project" down) 2>&1 | sed 's/^/   /' || warn "could not remove project $project - remove it by hand: docker compose -p $project down"
  done
}

run_stack() {
  select_stack "$1"
  log "===== $STACK  (branch $STACK_BRANCH, project $STACK_PROJECT) ====="
  prepare_checkout
  ensure_stack_files
  if [ "$FIX_ENV" = 1 ]; then
    log "Own values into the $STACK .env files (mongo '${MONGO_SERVICE_HOST}' of project ${STACK_PROJECT}, origin https://${STACK_FRONT})"
    fix_env_files
  fi
  place_env_files
  start_stack
  read_addresses
  wait_for_answers
  check_sign_in
  seed_admin
  write_stack_nginx
  STACK_RESULT_NOT_ANSWERING["$STACK"]="${NOT_ANSWERING[*]:-}"
}

main() {
  parse_args "$@"
  preflight
  declare -g -A STACK_RESULT_NOT_ANSWERING=()
  STARTED_WORK=1
  trap restore_production EXIT
  retire_legacy_projects
  local name failed=""
  for name in "${STACKS[@]}"; do
    run_stack "$name"
  done
  apply_nginx
  [ "$CLEAR_CACHE" = 1 ] && prune_build_leftovers
  for name in "${STACKS[@]}"; do
    select_stack "$name"
    refresh_addresses
    verify_stack
    [ -z "${STACK_RESULT_NOT_ANSWERING[$name]}" ] || failed="$failed $name:${STACK_RESULT_NOT_ANSWERING[$name]}"
  done
  if [ -n "$failed" ]; then
    log "Not answering:$failed"
    echo "   Read the logs printed above and fix the cause, then run the script again for that stack."
    exit 1
  fi
  log "Done"
  echo "   Container addresses change whenever a container is recreated: run this script again after any restart."
}

main "$@"
