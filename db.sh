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
#   sudo ./db.sh --list-collections --source uat|ikaze --db-name cok
#       every collection of that database: documents, size, indexes
#
#   sudo ./db.sh --copy-db-data --from uat --to ikaze --db-name 'cok,COK_EVENT_MNG'
#       copies whole databases from one stack's mongo to the other's, same
#       names. A database missing on the destination is created.
#
#   sudo ./db.sh --copy-collection --from uat --to ikaze --db-name cok --collection 'users,roles'
#       copies collections. Options: --to-db-name <name> and, for a single
#       collection, --to-collection <name> to land under another name. With a
#       new name the source and destination stack may be the same. A missing
#       destination database or collection is created.
#
#   Existing documents on the destination are kept and documents with the
#   same _id are skipped; add --replace to drop the destination database or
#   collection first so it becomes an exact copy. Copying INTO production
#   first dumps what is about to change to backups/ in the folder.
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
TO_DB_NAME=""
COLLECTIONS=""
TO_COLLECTION=""
REPLACE=0
DRY_RUN=0
STAMP="$(date '+%Y%m%d-%H%M%S')"
# Databases MongoDB keeps for itself; the root user may not even count them.
SYSTEM_DATABASES="admin config local"

usage() { sed -n '3,31p' "$0"; }

# --key value and --key=value are both accepted.
parse_args() {
  while [ $# -gt 0 ]; do
    local arg="$1" value=""
    case "$arg" in
      --*=*) value="${arg#*=}"; arg="${arg%%=*}" ;;
      --source|--from|--to|--db-name|--to-db-name|--collection|--to-collection) value="${2:-}"; shift ;;
    esac
    case "$arg" in
      --list-db) ACTION="list" ;;
      --list-collections) ACTION="collections" ;;
      --copy-db-data) ACTION="copy" ;;
      --copy-collection) ACTION="copy-collection" ;;
      --source) SOURCE="$value" ;;
      --from) FROM="$value" ;;
      --to) TO="$value" ;;
      --db-name) DB_NAMES="$value" ;;
      --to-db-name) TO_DB_NAME="$value" ;;
      --collection) COLLECTIONS="$value" ;;
      --to-collection) TO_COLLECTION="$value" ;;
      --replace) REPLACE=1 ;;
      --dry-run) DRY_RUN=1 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
    esac
    shift
  done
}

# --- one stack's mongo ---------------------------------------------------------
stack_project() { local dir project; stack_paths "$1" dir project || die "unknown stack '$1'"; printf '%s' "$project"; }

stack_compose() {
  local stack="$1"; shift
  (cd "$REPO_DIR" && docker compose -p "$(stack_project "$stack")" "$@")
}

mongo_auth_args() {
  local compose_file="$REPO_DIR/docker-compose.yml" user pass
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

# mongosh with a script (stdin) against one database of a stack. The script
# goes in through --eval: fed on stdin, mongosh would echo its prompt.
mongo_script() {
  local stack="$1" database="$2" user pass script
  { read -r user; read -r pass; } < <(mongo_auth_args "$stack")
  script="$(cat)"
  stack_compose "$stack" exec -T mongo mongosh --quiet -u "$user" -p "$pass" --authenticationDatabase admin "$database" --eval "$script" | tr -d '\r'
}

# A JSON string literal for mongosh: quotes and backslashes escaped.
js_string() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }

database_names() {
  printf 'db.adminCommand({ listDatabases: 1 }).databases.forEach((d) => print(d.name));' | mongo_script "$1" admin
}
has_database() { database_names "$1" | grep -qx -- "$2"; }

collection_names() {
  printf 'db.getSiblingDB(%s).getCollectionNames().forEach((c) => print(c));' "$(js_string "$2")" | mongo_script "$1" admin
}
has_collection() { collection_names "$1" "$2" | grep -qx -- "$3"; }

# --- list -------------------------------------------------------------------------
list_stack() {
  local stack="$1"
  log "Databases of $stack (project $(stack_project "$stack"))"
  mongo_is_running "$stack" || { warn "the mongo container of $stack is not running"; return 0; }
  printf '   %-28s %11s %11s %10s\n' "DATABASE" "COLLECTIONS" "DOCUMENTS" "SIZE (MB)"
  mongo_script "$stack" admin <<EOF | awk -F'\t' '{ printf "   %-28s %11s %11s %10s\n", $1, $2, $3, $4 }'
const skip = $(js_string "$SYSTEM_DATABASES").split(" ");
db.adminCommand({ listDatabases: 1 }).databases.forEach((entry) => {
  if (skip.includes(entry.name)) return;
  const handle = db.getSiblingDB(entry.name);
  const names = handle.getCollectionNames().filter((name) => !name.startsWith("system."));
  let documents = 0;
  names.forEach((name) => { documents += handle.getCollection(name).countDocuments(); });
  print([entry.name, names.length, documents, (entry.sizeOnDisk / 1048576).toFixed(1)].join("\t"));
});
EOF
}

list_collections() {
  local stack="$1" database="$2"
  log "Collections of '$database' on $stack (project $(stack_project "$stack"))"
  mongo_is_running "$stack" || { warn "the mongo container of $stack is not running"; return 0; }
  has_database "$stack" "$database" || { warn "'$database' does not exist on $stack"; return 1; }
  printf '   %-36s %11s %10s %8s\n' "COLLECTION" "DOCUMENTS" "SIZE (MB)" "INDEXES"
  mongo_script "$stack" admin <<EOF | awk -F'\t' '{ printf "   %-36s %11s %10s %8s\n", $1, $2, $3, $4 }'
const handle = db.getSiblingDB($(js_string "$database"));
handle.getCollectionNames().filter((name) => !name.startsWith("system.")).sort().forEach((name) => {
  const stats = handle.getCollection(name).aggregate([{ \$collStats: { storageStats: {} } }]).toArray()[0];
  const size = stats && stats.storageStats ? stats.storageStats.size : 0;
  const indexes = stats && stats.storageStats ? Object.keys(stats.storageStats.indexSizes || {}).length : 0;
  print([name, handle.getCollection(name).countDocuments(), (size / 1048576).toFixed(2), indexes].join("\t"));
});
EOF
}

# --- copy -------------------------------------------------------------------------
# One dump on the source piped into one restore on the destination; the
# restore creates whatever does not exist. Extra restore options (--drop,
# --nsFrom/--nsTo) come as the remaining arguments.
stream_copy() {
  local from="$1" to="$2" database="$3" collection="$4" ns_include="$5"; shift 5
  local src_user src_pass dst_user dst_pass
  { read -r src_user; read -r src_pass; } < <(mongo_auth_args "$from")
  { read -r dst_user; read -r dst_pass; } < <(mongo_auth_args "$to")
  local dump=(mongodump --quiet -u "$src_user" -p "$src_pass" --authenticationDatabase admin --db "$database" --archive)
  [ -z "$collection" ] || dump+=(--collection "$collection")
  stack_compose "$from" exec -T mongo "${dump[@]}" \
    | stack_compose "$to" exec -T mongo mongorestore --quiet -u "$dst_user" -p "$dst_pass" --authenticationDatabase admin --archive --nsInclude "$ns_include" "$@"
}

# Production is dumped before anything is written into it.
backup_before_write() {
  local to="$1" database="$2" collection="$3" user pass
  [ "$to" = "ikaze" ] || return 0
  has_database "$to" "$database" || return 0
  [ -z "$collection" ] || has_collection "$to" "$database" "$collection" || return 0
  local target="$REPO_DIR/backups/${database}${collection:+.$collection}_before_copy_${STAMP}.archive.gz"
  if [ "$DRY_RUN" = 1 ]; then ok "(dry run) would back up production '$database${collection:+.$collection}' to $target"; return 0; fi
  { read -r user; read -r pass; } < <(mongo_auth_args "$to")
  mkdir -p "$(dirname "$target")"
  local dump=(mongodump --quiet -u "$user" -p "$pass" --authenticationDatabase admin --db "$database" --archive)
  [ -z "$collection" ] || dump+=(--collection "$collection")
  stack_compose "$to" exec -T mongo "${dump[@]}" | gzip > "$target" || { rm -f "$target"; die "backup of production '$database' failed - nothing was copied"; }
  ok "production '$database${collection:+.$collection}' backed up to $target"
}

copy_database() {
  local from="$1" to="$2" database="$3" drop=()
  if ! has_database "$from" "$database"; then warn "'$database' does not exist on $from - skipped"; return 1; fi
  if has_database "$to" "$database"; then
    if [ "$REPLACE" = 1 ]; then drop=(--drop); ok "'$database' exists on $to and will be replaced"; else ok "'$database' exists on $to - documents are added, same _id kept as on $to"; fi
  else
    ok "'$database' does not exist on $to yet - it will be created"
  fi
  backup_before_write "$to" "$database" ""
  if [ "$DRY_RUN" = 1 ]; then ok "(dry run) would copy '$database' from $from to $to"; return 0; fi
  log "Copying '$database': $from -> $to"
  stream_copy "$from" "$to" "$database" "" "${database}.*" "${drop[@]}"
  ok "'$database' copied to $to"
}

copy_collection() {
  local from="$1" to="$2" database="$3" collection="$4" to_database="$5" to_collection="$6" extra=() label
  label="$to_database.$to_collection"
  if ! has_collection "$from" "$database" "$collection"; then warn "'$database.$collection' does not exist on $from - skipped"; return 1; fi
  if has_collection "$to" "$to_database" "$to_collection"; then
    if [ "$REPLACE" = 1 ]; then extra+=(--drop); ok "'$label' exists on $to and will be replaced"; else ok "'$label' exists on $to - documents are added, same _id kept as on $to"; fi
  else
    ok "'$label' does not exist on $to yet - it will be created"
  fi
  [ "$database.$collection" = "$label" ] || extra+=(--nsFrom "$database.$collection" --nsTo "$label")
  backup_before_write "$to" "$to_database" "$to_collection"
  if [ "$DRY_RUN" = 1 ]; then ok "(dry run) would copy '$database.$collection' from $from to '$label' on $to"; return 0; fi
  log "Copying '$database.$collection': $from -> $to ($label)"
  stream_copy "$from" "$to" "$database" "$collection" "$database.$collection" "${extra[@]}"
  ok "'$label' ready on $to"
}

# --- main -----------------------------------------------------------------------------
resolve_stack() { local stack; stack="$(stack_name_of "$1")"; [ -n "$stack" ] || die "$2 must be uat or ikaze (got '$1')"; printf '%s' "$stack"; }

main() {
  parse_args "$@"
  need_cmd docker
  [ -n "$ACTION" ] || { usage; exit 2; }
  local from to name copied=0 failed=0
  case "$ACTION" in
    list)
      [ -n "$SOURCE" ] || die "--list-db needs --source uat|ikaze|all"
      if [ "$(printf '%s' "$SOURCE" | tr 'A-Z' 'a-z')" = "all" ]; then list_stack uat-ikaze; list_stack ikaze; else list_stack "$(resolve_stack "$SOURCE" --source)"; fi ;;
    collections)
      [ -n "$SOURCE" ] || die "--list-collections needs --source uat|ikaze"
      [ -n "$DB_NAMES" ] || die "--list-collections needs --db-name <database>"
      for name in $(printf '%s' "$DB_NAMES" | tr ',' ' '); do list_collections "$(resolve_stack "$SOURCE" --source)" "$name" || true; done ;;
    copy)
      from="$(resolve_stack "$FROM" --from)"; to="$(resolve_stack "$TO" --to)"
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
    copy-collection)
      from="$(resolve_stack "$FROM" --from)"; to="$(resolve_stack "$TO" --to)"
      [ -n "$DB_NAMES" ] && [ "${DB_NAMES//,/}" = "$DB_NAMES" ] || die "--copy-collection needs exactly one --db-name"
      [ -n "$COLLECTIONS" ] || die "--collection needs one or more collection names, separated by commas"
      local to_database="${TO_DB_NAME:-$DB_NAMES}"
      if [ -n "$TO_COLLECTION" ] && [ "${COLLECTIONS//,/}" != "$COLLECTIONS" ]; then die "--to-collection works with a single --collection"; fi
      if [ "$from" = "$to" ] && [ "$to_database" = "$DB_NAMES" ] && [ -z "$TO_COLLECTION" ]; then die "same stack, same database and same collection names: nothing to copy (use --to-db-name or --to-collection)"; fi
      mongo_is_running "$from" || die "the mongo container of $from is not running"
      mongo_is_running "$to" || die "the mongo container of $to is not running"
      log "Copy collections $from:$DB_NAMES -> $to:$to_database: $COLLECTIONS$([ "$REPLACE" = 1 ] && printf ' (replace)' || true)$([ "$DRY_RUN" = 1 ] && printf ' (dry run)' || true)"
      for name in $(printf '%s' "$COLLECTIONS" | tr ',' ' '); do
        if copy_collection "$from" "$to" "$DB_NAMES" "$name" "$to_database" "${TO_COLLECTION:-$name}"; then copied=$((copied + 1)); else failed=$((failed + 1)); fi
      done
      log "Done: $copied copied, $failed skipped"
      [ "$failed" -eq 0 ] || exit 1 ;;
  esac
}

main "$@"
