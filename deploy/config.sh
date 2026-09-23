#!/usr/bin/env bash
# The two stacks, shared by update-deploy.sh and db.sh. Sourced; expects
# REPO_DIR (this checkout, where these scripts live).
#
# Both stacks are built from THIS ONE FOLDER: the script checks out the
# stack's branch, builds and starts the stack's compose project, then moves
# on. What tells them apart at runtime is the compose project name (own
# network, containers, mongo, volumes), the public hosts, and the .env files,
# of which each stack keeps its own set under deploy/env/<stack>/ (git-ignored)
# that the script copies into place before building.

REPO_BRANCH_PROD="ikaze"
REPO_BRANCH_UAT="uat"

PROD_DIR="$REPO_DIR"
PROD_BRANCH="$REPO_BRANCH_PROD"
PROD_PROJECT="cok-systems"
PROD_FRONT="ikaze.kigalicity.gov.rw"
PROD_BACKEND_HOST=""
PROD_EVENTS_HOST=""
PROD_DCS_HOST=""

UAT_DIR="$REPO_DIR"
UAT_BRANCH="$REPO_BRANCH_UAT"
UAT_PROJECT="cok-systems-uat"
UAT_FRONT="uat-ikaze.kigalicity.gov.rw"
UAT_BACKEND_HOST="uatps-ikaze.kigalicity.gov.rw"
UAT_EVENTS_HOST="uate-ikaze.kigalicity.gov.rw"
UAT_DCS_HOST="dcms.kigalicity.gov.rw"

# Where each stack's .env files live between runs: deploy/env/<stack>/<service>.env
ENV_STORE="$REPO_DIR/deploy/env"
ENV_SERVICES=(backend em_backend dc_backend)

# "ikaze" or "uat-ikaze" from the spellings people type; "" when unknown.
stack_name_of() {
  case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in
    ikaze|prod|production) echo "ikaze" ;;
    uat|uat-ikaze|acceptance) echo "uat-ikaze" ;;
    *) echo "" ;;
  esac
}

# The checkout and compose project of a stack: sets the two named variables.
stack_paths() {
  local stack="$1" dir_var="$2" project_var="$3"
  case "$stack" in
    ikaze) printf -v "$dir_var" '%s' "$PROD_DIR"; printf -v "$project_var" '%s' "$PROD_PROJECT" ;;
    uat-ikaze) printf -v "$dir_var" '%s' "$UAT_DIR"; printf -v "$project_var" '%s' "$UAT_PROJECT" ;;
    *) return 1 ;;
  esac
}
