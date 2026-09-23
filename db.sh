#!/usr/bin/env bash
# =============================================================================
# db.sh - look at, and copy between, the MongoDB databases of the two stacks.
#
# Works straight on the mongo containers with mongosh, mongodump and
# mongorestore (no application code, no mongoose). The stacks and their
# compose projects are the ones update-deploy.sh manages (deploy/config.sh).
#
#   sudo ./db.sh --list-db --source uat|ikaze|all
#       every database of the stack: collections, documents, size on disk
#
#   sudo ./db.sh --copy-db-data --from uat --to ikaze --db-name 'cok,COK_EVENT_MNG'
#       copies whole databases from one stack's mongo to the other's, same
#       names. A database missing on the destination is created. Existing
#       documents on the destination are kept and documents with the same _id
#       are skipped; add --replace to drop each destination database first so
#       it becomes an exact copy. Copying INTO production first dumps the
#       destination database to backups/ in the production checkout.
#
#   options: --replace  --dry-run
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$REPO_DIR/deploy/common.sh"
source "$REPO_DIR/deploy/config.sh"

ACTION=""
SOURCE=""
FROM=""
TO=""
DB_NAMES=""
REPLACE=0
DRY_RUN=0
STAMP="$(date '+%Y%m%d-%H%M%S')"

usage() { sed -n '3,21p' "$0"; }

# --key value and --key=value are both accepted.
parse_args() {
  while [ $# -gt 0 ]; do
    local arg="$1" value=""
    case "$arg" in
      --*=*) value="${arg#*=}"; arg="${arg%%=*}" ;;
      --source|--from|--to|--db-name) value="${2:-}"; shift ;;
    esac
    case "$arg" in
      --list-db) ACTION="list" ;;
      --copy-db-data) ACTION="copy" ;;
      --source) SOURCE="$value" ;;
      --from) FROM="$value" ;;
      --to) TO="$value" ;;
      --db-name) DB_NAMES="$value" ;;
      --replace) REPLACE=1 ;;
      --dry-run) DRY_RUN=1 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
    esac
    shift
  done
}

# --- one stack's mongo ---------------------------------------------------------
# Every helper takes the stack name first and reads the credentials from that
# stack's docker-compose.yml, so two stacks can be addressed in one command.
stack_dir() { local dir project; stack_paths "$1" dir project || die "unknown stack '$1'"; printf '%s' "$dir"; }
stack_project() { local dir project; stack_paths "$1" dir project || die "unknown stack '$1'"; printf '%s' "$project"; }

stack_compose() {
  local stack="$1"; shift
  local dir project
  dir="$(stack_dir "$stack")"; project="$(stack_project "$stack")"
  [ -d "$dir" ] || die "$stack has no checkout at $dir - run update-deploy.sh for it first"
  (cd "$dir" && docker compose -p "$project" "$@")
}

mongo_auth_args() {
  local compose_file
  compose_file="$(stack_dir "$1")/docker-compose.yml"
  local user pass
  user="$(compose_value "$compose_file" MONGO_INITDB_ROOT_USERNAME)"
  pass="$(compose_value "$compose_file" MONGO_INITDB_ROOT_PASSWORD)"
  [ -n "$user" ] && [ -n "$pass" ] || die "$compose_file has no MONGO_INITDB_ROOT_USERNAME / PASSWORD"
  printf '%s\n%s\n' "$user" "$pass"
}

mongo_is_running() {
  local id
  id="$(stack_compose "$1" ps -q mongo 2>/dev/null | head -n 1)"
  [ -n "$id" ] && [ "$(docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null)" = "running" ]
}

# mongosh with a script on stdin, against one database of a stack.
mongo_script() {
  local stack="$1" database="$2" user pass
  { read -r user; read -r pass; } < <(mongo_auth_args "$stack")
  stack_compose "$stack" exec -T mongo mongosh --quiet -u "$user" -p "$pass" --authenticationDatabase admin "$database"
}

# The database names of a stack, one per line.
database_names() {
  printf 'db.adminCommand({ listDatabases: 1 }).databases.forEach((d) => print(d.name));\n' | mongo_script "$1" admin | tr -d '\r'
}

has_database() { database_names "$1" | grep -qx -- "$2"; }

# --- list -------------------------------------------------------------------------
list_stack() {
  local stack="$1"
  log "Databases of $stack (project $(stack_project "$stack"))"
  mongo_is_running "$stack" || { warn "the mongo container of $stack is not running"; return 0; }
  printf '   %-28s %11s %11s %10s\n' "DATABASE" "COLLECTIONS" "DOCUMENTS" "SIZE (MB)"
  mongo_script "$stack" admin <<'EOF' | tr -d '\r' | awk -F'\t' '{ printf "   %-28s %11s %11s %10s\n", $1, $2, $3, $4 }'
db.adminCommand({ listDatabases: 1 }).databases.forEach((entry) => {
  const handle = db.getSiblingDB(entry.name);
  const names = handle.getCollectionNames();
  let documents = 0;
  names.forEach((name) => { documents += handle.getCollection(name).countDocuments(); });
  print([entry.name, names.length, documents, (entry.sizeOnDisk / 1048576).toFixed(1)].join("\t"));
});
EOF
}

# --- copy -------------------------------------------------------------------------
# One database, source stack to destination stack, streamed container to
# container: mongodump writes an archive to stdout, mongorestore reads it on
# stdin. mongorestore creates what does not exist.
copy_database() {
  local from="$1" to="$2" database="$3" src_user src_pass dst_user dst_pass drop=""
  { read -r src_user; read -r src_pass; } < <(mongo_auth_args "$from")
  { read -r dst_user; read -r dst_pass; } < <(mongo_auth_args "$to")
  if ! has_database "$from" "$database"; then
    warn "'$database' does not exist on $from - skipped"
    return 1
  fi
  if has_database "$to" "$database"; then
    if [ "$REPLACE" = 1 ]; then drop="--drop"; ok "'$database' exists on $to and will be replaced"; else ok "'$database' exists on $to - documents are added, same _id kept as on $to"; fi
  else
    ok "'$database' does not exist on $to yet - it will be created"
  fi
  if [ "$to" = "ikaze" ] && has_database "$to" "$database"; then
    local target="$(stack_dir "$to")/backups/${database}_before_copy_${STAMP}.archive.gz"
    if [ "$DRY_RUN" = 1 ]; then
      ok "(dry run) would back up production '$database' to $target"
    else
      mkdir -p "$(dirname "$target")"
      stack_compose "$to" exec -T mongo mongodump --quiet -u "$dst_user" -p "$dst_pass" --authenticationDatabase admin --db "$database" --archive | gzip > "$target" || { rm -f "$target"; die "backup of production '$database' failed - nothing was copied"; }
      ok "production '$database' backed up to $target"
    fi
  fi
  if [ "$DRY_RUN" = 1 ]; then
    ok "(dry run) would copy '$database' from $from to $to${drop:+ (replacing it)}"
    return 0
  fi
  log "Copying '$database': $from -> $to"
  stack_compose "$from" exec -T mongo mongodump --quiet -u "$src_user" -p "$src_pass" --authenticationDatabase admin --db "$database" --archive \
    | stack_compose "$to" exec -T mongo mongorestore --quiet -u "$dst_user" -p "$dst_pass" --authenticationDatabase admin --archive --nsInclude "${database}.*" $drop
  ok "'$database' copied to $to"
}

# --- main -----------------------------------------------------------------------------
main() {
  parse_args "$@"
  need_cmd docker
  [ -n "$ACTION" ] || { usage; exit 2; }
  case "$ACTION" in
    list)
      [ -n "$SOURCE" ] || die "--list-db needs --source uat|ikaze|all"
      if [ "$(printf '%s' "$SOURCE" | tr 'A-Z' 'a-z')" = "all" ]; then
        list_stack uat-ikaze
        list_stack ikaze
      else
        local stack; stack="$(stack_name_of "$SOURCE")"
        [ -n "$stack" ] || die "unknown source '$SOURCE' (use uat, ikaze or all)"
        list_stack "$stack"
      fi ;;
    copy)
      local from to name copied=0 failed=0
      from="$(stack_name_of "$FROM")"; to="$(stack_name_of "$TO")"
      [ -n "$from" ] || die "--from must be uat or ikaze"
      [ -n "$to" ] || die "--to must be uat or ikaze"
      [ "$from" != "$to" ] || die "--from and --to name the same stack"
      [ -n "$DB_NAMES" ] || die "--db-name needs one or more database names, separated by commas"
      mongo_is_running "$from" || die "the mongo container of $from is not running"
      mongo_is_running "$to" || die "the mongo container of $to is not running"
      log "Copy $from -> $to: $DB_NAMES$([ "$REPLACE" = 1 ] && printf ' (replace)' || true)$([ "$DRY_RUN" = 1 ] && printf ' (dry run)' || true)"
      for name in $(printf '%s' "$DB_NAMES" | tr ',' ' '); do
        if copy_database "$from" "$to" "$name"; then copied=$((copied + 1)); else failed=$((failed + 1)); fi
      done
      log "Done: $copied copied, $failed skipped"
      [ "$failed" -eq 0 ] || exit 1 ;;
  esac
}

main "$@"
