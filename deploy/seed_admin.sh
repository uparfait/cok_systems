#!/usr/bin/env bash
# The first production user comes from UAT: the person is found by email in
# the UAT "cok" database and copied into production with the role and the
# department it refers to, activated and unlocked. An account that already
# exists in production (same email or same id) is left exactly as it is.
# --admin-email=<email> on the command line means production is being
# created for the first time, so the copy runs without any question; without
# it, the copy is offered only when production has no account at all.
# Sourced by update-deploy.sh; needs the STACK_* globals of the production
# stack and the UAT mongo running.

# Number of accounts in this stack's cok database, or "" when it cannot be read.
count_users() {
  local out
  out="$(printf 'print(db.users.countDocuments())\n' | mongo_run cok 2>/dev/null | tail -n 1 | tr -d '\r')" || true
  case "$out" in ''|*[!0-9]*) echo "" ;; *) echo "$out" ;; esac
}

# A JSON string literal for mongosh: quotes and backslashes escaped.
js_string() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }

# Reads one person from the UAT accounts: prints "PAYLOAD <json>", "NOT_FOUND", or nothing on error.
read_user_from_uat() {
  local email="$1"
  local prod_dir="$STACK_DIR" prod_project="$STACK_PROJECT"
  STACK_DIR="$UAT_DIR"; STACK_PROJECT="$UAT_PROJECT"
  mongo_run cok <<EOF || true
const email = $(js_string "$email");
const escaped = email.replace(/[.*+?^\${}()|[\]\\\\]/g, "\\\\\$&");
const user = db.users.findOne({ email: { \$regex: "^" + escaped + "\$", \$options: "i" } });
if (!user) { print("NOT_FOUND"); } else {
  const roleFilters = [];
  if (user.roles && user.roles.role_id) roleFilters.push({ _id: user.roles.role_id });
  if (user.roles && user.roles.role_name) roleFilters.push({ role_name: user.roles.role_name });
  const role = roleFilters.length ? db.roles.findOne({ \$or: roleFilters }) : null;
  const department = user.department ? db.departments.findOne({ _id: user.department }) : null;
  print("PAYLOAD " + EJSON.stringify({ user, role, department }));
}
EOF
  STACK_DIR="$prod_dir"; STACK_PROJECT="$prod_project"
}

# Writes the person into production unless already there: prints "EXISTS <email>" or "COPIED <details>".
write_user_into_production() {
  local json="$1"
  mongo_run cok <<EOF || true
const payload = EJSON.parse($(js_string "$json"));
const email = payload.user.email || "";
const escaped = email.replace(/[.*+?^\${}()|[\]\\\\]/g, "\\\\\$&");
const existing = db.users.findOne({ \$or: [{ _id: payload.user._id }, { email: { \$regex: "^" + escaped + "\$", \$options: "i" } }] });
if (existing) {
  print("EXISTS " + existing.email);
} else {
  payload.user.is_account_activated = true;
  if (payload.user.access_control) payload.user.access_control.is_locked = false;
  if (payload.role && !db.roles.findOne({ _id: payload.role._id })) db.roles.insertOne(payload.role);
  if (payload.department && !db.departments.findOne({ _id: payload.department._id })) db.departments.insertOne(payload.department);
  db.users.insertOne(payload.user);
  const role_name = (payload.user.roles && payload.user.roles.role_name) || "no role";
  const department_name = payload.department ? " with department " + (payload.department.name || payload.department.department_name || payload.department._id) : "";
  print("COPIED " + payload.user.email + " (" + role_name + ")" + department_name);
}
EOF
}

# One email, UAT to production. Returns 0 when the person is in production afterwards.
copy_user_from_uat() {
  local email="$1" payload marker outcome result
  local prod_dir="$STACK_DIR" prod_project="$STACK_PROJECT"
  STACK_DIR="$UAT_DIR"; STACK_PROJECT="$UAT_PROJECT"
  if [ "$(container_state mongo)" != "running" ]; then
    STACK_DIR="$prod_dir"; STACK_PROJECT="$prod_project"
    warn "the UAT mongo is not running, so no account can be copied - run the UAT stack first (sudo ./update-deploy.sh --uat-ikaze)"
    return 1
  fi
  STACK_DIR="$prod_dir"; STACK_PROJECT="$prod_project"
  payload="$(read_user_from_uat "$email")"
  marker="$(printf '%s\n' "$payload" | grep -E '^(NOT_FOUND|PAYLOAD )' | tail -n 1)"
  case "$marker" in
    NOT_FOUND) warn "no account with email '$email' in the UAT database"; return 1 ;;
    "PAYLOAD "*) ;;
    *) warn "could not read the UAT database: ${payload:-no output}"; return 1 ;;
  esac
  outcome="$(write_user_into_production "${marker#PAYLOAD }")"
  result="$(printf '%s\n' "$outcome" | grep -E '^(EXISTS|COPIED) ' | tail -n 1)"
  case "$result" in
    "EXISTS "*) ok "$email already has an account in production - nothing copied"; return 0 ;;
    "COPIED "*) ok "${result#COPIED }"; return 0 ;;
    *) warn "could not write into the production database: ${outcome:-no output}"; return 1 ;;
  esac
}

# Production only.
seed_admin() {
  [ "$STACK" = "ikaze" ] || return 0
  if [ "$DRY_RUN" = 1 ]; then
    [ -z "$ADMIN_EMAIL" ] || ok "(dry run) would copy $ADMIN_EMAIL from the UAT accounts into production, unless already there"
    return 0
  fi
  local count email
  if [ -n "$ADMIN_EMAIL" ]; then
    log "First production deployment: $ADMIN_EMAIL is copied from UAT into production"
    copy_user_from_uat "$ADMIN_EMAIL" || warn "the account could not be copied - see above, then run again with --ikaze --admin-email=..."
    return 0
  fi
  count="$(count_users)"
  if [ -z "$count" ]; then warn "could not count the accounts in the production database (mongo not ready?) - skipping the first-user step"; return 0; fi
  if [ "$count" -gt 0 ]; then ok "production has $count account(s)"; return 0; fi
  log "Production has no account yet - the first user is copied from UAT"
  email=""
  while :; do
    if [ -z "$email" ]; then
      if [ -t 0 ]; then read -r -p "   Email of the UAT user to copy into production (empty to skip): " email; else warn "no terminal to ask on - run again with --admin-email=someone@kigalicity.gov.rw"; return 0; fi
    fi
    [ -n "$email" ] || { warn "skipped - create the first account through the application or restore a dump"; return 0; }
    if copy_user_from_uat "$email"; then return 0; fi
    email=""
    [ -t 0 ] || return 0
  done
}
