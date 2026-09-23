#!/usr/bin/env bash
# The two stacks, shared by update-deploy.sh and db.sh. Sourced; expects
# REPO_DIR (the production checkout, where these scripts live).

PROD_DIR="$REPO_DIR"
PROD_BRANCH="ikaze"
PROD_PROJECT="cok-systems"
PROD_FRONT="ikaze.kigalicity.gov.rw"
PROD_BACKEND_HOST=""
PROD_EVENTS_HOST=""
PROD_DCS_HOST=""

UAT_DIR="$(dirname "$REPO_DIR")/$(basename "$REPO_DIR")-uat"
UAT_BRANCH="uat"
UAT_PROJECT="cok-systems-uat"
UAT_FRONT="uat-ikaze.kigalicity.gov.rw"
UAT_BACKEND_HOST="uatps-ikaze.kigalicity.gov.rw"
UAT_EVENTS_HOST="uate-ikaze.kigalicity.gov.rw"
UAT_DCS_HOST="dcms.kigalicity.gov.rw"

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
