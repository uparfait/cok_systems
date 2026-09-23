#!/usr/bin/env bash
# =============================================================================
# update-deploy.sh - one command to update the IKAZE deployments on the server.
#
# Two STACKS live side by side, each a separate Docker Compose project with
# its own network, containers, mongo and volumes, its own .env files and its
# own public hosts, so nothing of one can touch the other:
#
#   ikaze      production   branch "ikaze"   this checkout          project cok-systems
#   uat-ikaze  acceptance   branch "uat"     ../<this folder>-uat   project cok-systems-uat
#
#   sudo ./update-deploy.sh                  both stacks (UAT first), same as --all
#   sudo ./update-deploy.sh --ikaze          production only
#   sudo ./update-deploy.sh --uat-ikaze      UAT only
#   sudo ./update-deploy.sh --ikaze-fresh    production, databases started from scratch
#   sudo ./update-deploy.sh --uat-ikaze-fresh
#   sudo ./update-deploy.sh --all-fresh      both, databases started from scratch
#   options: --no-pull  --no-build  --keep-env  --dry-run  --admin-email=<email>
#
# For each stack, in order:
#   1. the checkout is put on its branch and pulled (cloned the first time)
#   2. docker-compose.yml and the three .env files are copied from production
#      when missing, then given this stack's own values: every database line
#      on the stack's own mongo (credentials from its docker-compose.yml), its
#      own frontend host as the allowed browser origin, one JWT_SECRET for its
#      three backends that differs from the other stack's
#   3. with -fresh: production is backed up, then the stack's mongo container
#      and data volume are removed (upload volumes are kept)
#   4. mongo is started if needed, the services are rebuilt and restarted
#   5. container addresses are read, every container is waited for, the
#      sign-in settings are checked and the backends' own report is shown
#   6. production only: an empty accounts database gets its first user copied
#      from UAT (the script asks for the email)
#   7. the stack's nginx file is written from the container addresses
# Then nginx is tested and restarted once, and every public URL is verified.
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
ADMIN_EMAIL=""
STAMP="$(date '+%Y%m%d-%H%M%S')"
STACKS=()
FRESH_STACKS=()

usage() { sed -n '3,33p' "$0"; }

parse_args() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --all) STACKS=(uat-ikaze ikaze) ;;
      --ikaze) STACKS+=(ikaze) ;;
      --uat-ikaze) STACKS+=(uat-ikaze) ;;
      --all-fresh) STACKS=(uat-ikaze ikaze); FRESH_STACKS=(uat-ikaze ikaze) ;;
      --ikaze-fresh) STACKS+=(ikaze); FRESH_STACKS+=(ikaze) ;;
      --uat-ikaze-fresh) STACKS+=(uat-ikaze); FRESH_STACKS+=(uat-ikaze) ;;
      --no-pull) PULL=0 ;;
      --no-build) BUILD=0 ;;
      --keep-env) FIX_ENV=0 ;;
      --dry-run) DRY_RUN=1 ;;
      --admin-email=*) ADMIN_EMAIL="${arg#*=}" ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
    esac
  done
  [ "${#STACKS[@]}" -gt 0 ] || STACKS=(uat-ikaze ikaze)
}

is_fresh() {
  local name
  for name in "${FRESH_STACKS[@]:-}"; do [ "$name" = "$1" ] && return 0; done
  return 1
}

preflight() {
  [ "$DRY_RUN" = 1 ] || [ "$(id -u)" = 0 ] || die "run with sudo: it writes $NGINX_DIR and restarts nginx"
  need_cmd docker
  need_cmd curl
  need_cmd git
  [ "$DRY_RUN" = 1 ] || need_cmd nginx
  [ -f "$PROD_DIR/docker-compose.yml" ] || die "docker-compose.yml not found in $PROD_DIR"
}

run_stack() {
  select_stack "$1"
  log "===== $STACK  (branch $STACK_BRANCH, project $STACK_PROJECT, $STACK_DIR) ====="
  prepare_checkout
  ensure_stack_files
  if [ "$FIX_ENV" = 1 ]; then
    log "Own values into the $STACK .env files (mongo '${MONGO_SERVICE_HOST}' of project ${STACK_PROJECT}, origin https://${STACK_FRONT})"
    fix_env_files
  fi
  if is_fresh "$STACK"; then fresh_mongo; fi
  start_stack
  read_addresses
  wait_for_answers
  check_sign_in
  seed_admin_if_empty
  write_stack_nginx
  STACK_RESULT_NOT_ANSWERING["$STACK"]="${NOT_ANSWERING[*]:-}"
}

main() {
  parse_args "$@"
  preflight
  declare -g -A STACK_RESULT_NOT_ANSWERING=()
  local name failed=""
  for name in "${STACKS[@]}"; do
    run_stack "$name"
  done
  apply_nginx
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
