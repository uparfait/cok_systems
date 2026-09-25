#!/usr/bin/env bash
# =============================================================================
# deploy-agent.sh - runs the deployments the Deployment Management page asks
# for, ON THE HOST.
#
# The page cannot run update-deploy.sh itself. That script needs the host's
# own nginx (/etc/nginx/sites-available and systemctl), the host's docker,
# git and real bash - none of which exist in the backend's alpine
# container - and it recreates the backend container, which would kill the
# very process running it partway through. So the backend only ever WRITES
# DOWN what it wants, and this agent, running on the host, does it.
#
# The two sides share one folder, deploy/runs, which the backend container
# sees through the bind mount in docker-compose.yml:
#
#   <run_id>.request   written by the backend: the target to deploy
#   <run_id>.log       the console output, which the page reads by offset
#   <run_id>.json      the run's state: queued -> running -> succeeded/failed
#   agent.heartbeat    touched on every pass, so the page can say when
#                      nothing is listening
#
#   sudo ./deploy/deploy-agent.sh            keep running (what systemd uses)
#   sudo ./deploy/deploy-agent.sh --once     do the waiting work, then stop
#
# Install it with deploy/cok-deploy-agent.service.
# =============================================================================
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNS_DIR="$REPO_DIR/deploy/runs"
SCRIPT="$REPO_DIR/update-deploy.sh"
HEARTBEAT="$RUNS_DIR/agent.heartbeat"
POLL_SECONDS="${DEPLOY_AGENT_POLL_SECONDS:-3}"
ONCE=0

[ "${1:-}" != "--once" ] || ONCE=1

log() { printf '[agent] %s\n' "$*"; }

# The flag each target runs with. This is the ONLY place a target name
# becomes a command argument, and anything not named here is refused - the
# request file is written by a web request, so it is never trusted further
# than this table.
flag_for_target() {
  case "$1" in
    uat)   printf -- '--uat-ikaze' ;;
    ikaze) printf -- '--ikaze' ;;
    *)     return 1 ;;
  esac
}

# Rewrites one run's state file. jq is not assumed to be installed.
write_state() {
  local run_id="$1" status="$2" exit_code="$3" error="$4"
  local state="$RUNS_DIR/$run_id.json"
  local target started_by started_at
  target="$(sed -n 's/.*"target"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$state" 2>/dev/null | head -1)"
  started_by="$(sed -n 's/.*"started_by"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$state" 2>/dev/null | head -1)"
  started_at="$(sed -n 's/.*"started_at"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$state" 2>/dev/null | head -1)"
  local finished_at='null'
  [ "$status" = running ] || finished_at="\"$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')\""
  local code_json='null'
  [ -z "$exit_code" ] || code_json="$exit_code"
  local error_json='null'
  [ -z "$error" ] || error_json="\"$error\""

  cat > "$state" <<EOF
{
  "run_id": "$run_id",
  "target": "$target",
  "started_by": "$started_by",
  "started_at": "$started_at",
  "finished_at": $finished_at,
  "status": "$status",
  "exit_code": $code_json,
  "error": $error_json,
  "ran_by": "host-agent"
}
EOF
}

run_one() {
  local request="$1"
  local run_id target flag log_file code
  run_id="$(basename "$request" .request)"
  target="$(tr -d ' \t\r\n' < "$request")"
  log_file="$RUNS_DIR/$run_id.log"

  # Taken before anything else: a second pass must never pick it up again,
  # even if the deployment below restarts this machine's containers.
  rm -f "$request"

  if ! flag="$(flag_for_target "$target")"; then
    log "refusing unknown target '$target' for $run_id"
    printf '\nThe agent does not know the target "%s", so nothing was run.\n' "$target" >> "$log_file"
    write_state "$run_id" failed '' "unknown target $target"
    return 0
  fi

  if [ ! -f "$SCRIPT" ]; then
    printf '\nupdate-deploy.sh is not at %s on this host.\n' "$SCRIPT" >> "$log_file"
    write_state "$run_id" failed '' "update-deploy.sh missing on the host"
    return 0
  fi

  log "running $run_id ($target -> $flag)"
  write_state "$run_id" running '' ''
  printf '\n[agent] running on %s as %s\n\n' "$(hostname)" "$(id -un)" >> "$log_file"

  # Output goes straight into the log the page is already reading. The
  # agent is not restarted by the deployment, so this survives to the end.
  bash "$SCRIPT" "$flag" >> "$log_file" 2>&1
  code=$?

  if [ "$code" -eq 0 ]; then
    printf '\nDeployment finished successfully.\n' >> "$log_file"
    write_state "$run_id" succeeded 0 ''
    log "$run_id finished"
  else
    printf '\nDeployment failed with exit code %s.\n' "$code" >> "$log_file"
    write_state "$run_id" failed "$code" "exit code $code"
    log "$run_id failed with $code"
  fi
}

drain() {
  local request
  # Oldest first, so requests are honoured in the order they were made.
  for request in $(ls -1 "$RUNS_DIR"/*.request 2>/dev/null | sort); do
    [ -f "$request" ] || continue
    run_one "$request"
  done
}

main() {
  mkdir -p "$RUNS_DIR"
  if [ "$(id -u)" != 0 ]; then
    log "WARNING: not running as root - update-deploy.sh writes $([ -d /etc/nginx ] && echo /etc/nginx || echo the nginx files) and restarts nginx, so it will fail. Start this with sudo."
  fi
  log "watching $RUNS_DIR (every ${POLL_SECONDS}s)"

  if [ "$ONCE" = 1 ]; then
    : > "$HEARTBEAT"
    drain
    return 0
  fi

  while :; do
    : > "$HEARTBEAT"
    drain
    sleep "$POLL_SECONDS"
  done
}

main "$@"
