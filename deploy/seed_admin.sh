#!/usr/bin/env bash
# A production database that has no accounts yet (first deployment, or a
# fresh start) gets its first user copied from UAT: the script asks for an
# email address, finds that person in the UAT "cok" database and copies the
# account, its role and its department into production, activated and
# unlocked. Sourced by update-deploy.sh; needs the STACK_* globals of the
# production stack and the UAT stack's mongo running.

# Number of accounts in this stack's cok database, or "" when it cannot be read.
count_users() {
  local out
  out="$(printf 'print(db.users.countDocuments())\n' | mongo_run cok 2>/dev/null | tail -n 1 | tr -d '\r')" || true
  case "$out" in ''|*[!0-9]*) echo "" ;; *) echo "$out" ;; esac
}

# A JSON string literal for mongosh: quotes and backslashes escaped.
js_string() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }

# Runs the copy for one email. Prints what happened, returns 0 when a user landed in production.
copy_user_from_uat() {
  local email="$1" payload marker
  local prod_dir="$STACK_DIR" prod_project="$STACK_PROJECT"
  # Read from UAT: the user by email (case-insensitive), the role and department it refers to.
  STACK_DIR="$UAT_DIR"; STACK_PROJECT="$UAT_PROJECT"
  if [ "$(container_state mongo)" != "running" ]; then
    STACK_DIR="$prod_dir"; STACK_PROJECT="$prod_project"
    warn "the UAT mongo is not running, so no account can be copied - run the UAT stack first (sudo ./update-deploy.sh --uat-ikaze)"
    return 1
  fi
  payload="$(mongo_run cok <<EOF
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
)" || true
  STACK_DIR="$prod_dir"; STACK_PROJECT="$prod_project"
  marker="$(printf '%s\n' "$payload" | grep -E '^(NOT_FOUND|PAYLOAD )' | tail -n 1)"
  case "$marker" in
    NOT_FOUND) warn "no account with email '$email' in the UAT database"; return 1 ;;
    "PAYLOAD "*) ;;
    *) warn "could not read the UAT database: ${payload:-no output}"; return 1 ;;
  esac
  # Write into production: same ids, activated and unlocked.
  mongo_run cok <<EOF | sed 's/^/   | /'
const payload = EJSON.parse($(js_string "${marker#PAYLOAD }"));
payload.user.is_account_activated = true;
if (payload.user.access_control) payload.user.access_control.is_locked = false;
if (payload.role) db.roles.replaceOne({ _id: payload.role._id }, payload.role, { upsert: true });
if (payload.department) db.departments.replaceOne({ _id: payload.department._id }, payload.department, { upsert: true });
db.users.replaceOne({ _id: payload.user._id }, payload.user, { upsert: true });
print("copied " + payload.user.email + " (" + ((payload.user.roles && payload.user.roles.role_name) || "no role") + ")" + (payload.department ? " with department " + (payload.department.name || payload.department.department_name || payload.department._id) : ""));
EOF
}

# Production only: when the cok database holds no account, one is copied from UAT.
seed_admin_if_empty() {
  [ "$STACK" = "ikaze" ] || return 0
  [ "$DRY_RUN" = 1 ] && return 0
  local count email
  count="$(count_users)"
  if [ -z "$count" ]; then warn "could not count the accounts in the production database (mongo not ready?) - skipping the first-user step"; return 0; fi
  if [ "$count" -gt 0 ]; then ok "production has $count account(s)"; return 0; fi
  log "Production has no account yet - the first user is copied from UAT"
  email="$ADMIN_EMAIL"
  while :; do
    if [ -z "$email" ]; then
      if [ -t 0 ]; then read -r -p "   Email of the UAT user to copy into production (empty to skip): " email; else warn "no terminal to ask on - pass --admin-email=someone@kigalicity.gov.rw"; return 0; fi
    fi
    [ -n "$email" ] || { warn "skipped - create the first account through the application or restore a dump"; return 0; }
    if copy_user_from_uat "$email"; then ok "first production account ready: $email"; return 0; fi
    email=""
    [ -t 0 ] || return 0
  done
}
