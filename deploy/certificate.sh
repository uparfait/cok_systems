#!/usr/bin/env bash
# =============================================================================
# certificate.sh - installs the SSL certificate the Deployment Management
# page uploads, and keeps deploy/runs/certificate.json saying which one
# the host nginx serves.
#
# Sourced by deploy-agent.sh, which calls handle_certificate_request for a
# request whose target is "certificate" and cert_refresh_status_if_stale
# on every pass. Run on its own,
#
#   bash deploy/certificate.sh --run <run_id>     install one request
#   bash deploy/certificate.sh --status           rewrite certificate.json
#
# does the same work without the agent (the backend uses --run when it
# runs on the host itself).
#
# A request is deploy/runs/<run_id>.zip holding three PEM files, told
# apart by CONTENT: one private key, the site certificate and the CA
# chain. The leaf is the certificate whose public key matches the key;
# every other certificate is the chain. Leaf + chain become
# CERT_DIR/CERT_NAME.crt and the key CERT_DIR/CERT_NAME.key (0600), after
# a backup, "nginx -t" and a reload. On any failure the backups go back
# and nginx is reloaded with them again. The zip is deleted either way: it
# holds the private key.
#
# Overridable through the environment so the logic runs without root:
#   CERT_DIR       where the files live           (/etc/nginx/certs)
#   CERT_NAME      their base name                (kigalicity.gov.rw)
#   NGINX_TEST     the configuration test         (nginx -t)
#   NGINX_RELOAD   the reload                     (systemctl reload nginx || nginx -s reload)
#   CERT_HOSTS     hosts the certificate should cover (those of deploy/config.sh)
#   RUNS_DIR       the request folder             (deploy/runs beside this file)
#
# Lines starting with "##phase " are progress markers for the page.
# =============================================================================

CERT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNS_DIR="${RUNS_DIR:-$CERT_SCRIPT_DIR/runs}"
CERT_DIR="${CERT_DIR:-/etc/nginx/certs}"
CERT_NAME="${CERT_NAME:-kigalicity.gov.rw}"
NGINX_TEST="${NGINX_TEST:-nginx -t}"
NGINX_RELOAD="${NGINX_RELOAD:-systemctl reload nginx || nginx -s reload}"
CERT_STATUS_FILE="${CERT_STATUS_FILE:-$RUNS_DIR/certificate.json}"
CERT_STATUS_MAX_AGE_MINUTES="${CERT_STATUS_MAX_AGE_MINUTES:-360}"

cert_phase() { printf '\n##phase %s\n' "$1"; }
cert_warn() { printf '   [WARN] %s\n' "$*"; }
# Only ever called inside the subshell of handle_certificate_request.
cert_abort() { printf '\n[FAIL] %s\n' "$*"; exit 1; }

cert_fingerprint() { openssl x509 -in "$1" -noout -fingerprint -sha256 2>/dev/null | sed 's/^[^=]*=//' | tr -d '\r'; }
cert_subject() { openssl x509 -in "$1" -noout -subject -nameopt RFC2253 2>/dev/null | sed 's/^subject=//' | tr -d '\r'; }
cert_issuer() { openssl x509 -in "$1" -noout -issuer -nameopt RFC2253 2>/dev/null | sed 's/^issuer=//' | tr -d '\r'; }
cert_start_date() { openssl x509 -in "$1" -noout -startdate 2>/dev/null | sed 's/^notBefore=//' | tr -d '\r'; }
cert_end_date() { openssl x509 -in "$1" -noout -enddate 2>/dev/null | sed 's/^notAfter=//' | tr -d '\r'; }
cert_iso_date() { date -u -d "$1" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || printf '%s' "$1"; }
cert_json_string() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

# The DNS names of a certificate, one per line.
cert_sans() {
  { openssl x509 -in "$1" -noout -ext subjectAltName 2>/dev/null || openssl x509 -in "$1" -noout -text 2>/dev/null | grep -A1 'Subject Alternative Name'; } \
    | tr ',' '\n' | sed -n 's/^[[:space:]]*DNS:[[:space:]]*//p' | tr -d '\r'
}

cert_describe() {
  local file="$1"
  printf '   subject:     %s\n' "$(cert_subject "$file")"
  printf '   issuer:      %s\n' "$(cert_issuer "$file")"
  printf '   valid from:  %s\n' "$(cert_start_date "$file")"
  printf '   valid until: %s\n' "$(cert_end_date "$file")"
  printf '   hosts:       %s\n' "$(cert_sans "$file" | tr '\n' ' ')"
  printf '   sha256:      %s\n' "$(cert_fingerprint "$file")"
}

# The hosts this server answers for: CERT_HOSTS, else deploy/config.sh.
cert_expected_hosts() {
  if [ -n "${CERT_HOSTS:-}" ]; then printf '%s\n' $CERT_HOSTS; return 0; fi
  local repo="${REPO_DIR:-$CERT_SCRIPT_DIR/..}"
  [ -f "$repo/deploy/config.sh" ] || return 0
  ( REPO_DIR="$repo"; . "$repo/deploy/config.sh"; printf '%s\n' $PROD_FRONT $UAT_FRONT $UAT_BACKEND_HOST $UAT_EVENTS_HOST $UAT_DCS_HOST $PROD_BACKEND_HOST $PROD_EVENTS_HOST $PROD_DCS_HOST )
}

# True when one of the names (exact or one-label wildcard) covers the host.
cert_host_covered() {
  local host="$1" san
  shift
  for san in "$@"; do
    [ "$san" = "$host" ] && return 0
    case "$san" in
      '*.'*) [ "${host#*.}" = "${san#\*.}" ] && [ "${host%%.*}" != "$host" ] && return 0 ;;
    esac
  done
  return 1
}

# Unpacks the zip flat into a folder with whatever this host has.
cert_extract() {
  local zip="$1" dir="$2"
  if command -v unzip >/dev/null 2>&1; then
    unzip -j -o -q "$zip" -x '__MACOSX/*' -d "$dir" >/dev/null 2>&1
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import os, sys, zipfile
zip_path, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as archive:
    for info in archive.infolist():
        if info.is_dir() or info.filename.startswith("__MACOSX/"):
            continue
        name = os.path.basename(info.filename)
        if not name:
            continue
        with archive.open(info) as src, open(os.path.join(out, name), "wb") as dst:
            dst.write(src.read())' "$zip" "$dir"
  elif tar --version 2>/dev/null | grep -q bsdtar; then
    tar -xf "$zip" -C "$dir" && { find "$dir" -mindepth 2 -type f -exec mv -f -t "$dir" {} + 2>/dev/null || true; }
  else
    return 1
  fi
}

# Writes every certificate block of a file to $2/$3-NNN.pem; prints the count.
cert_split_blocks() {
  tr -d '\r' < "$1" | awk -v out="$2" -v prefix="$3" '
    /-----BEGIN CERTIFICATE-----/ { n++; name = sprintf("%s/%s-%03d.pem", out, prefix, n); inside = 1 }
    inside { print > name }
    /-----END CERTIFICATE-----/ { if (inside) close(name); inside = 0 }
    END { print n + 0 }
  '
}

# Writes $1 to $2 with mode $3 (0600 or 0644): created under the matching
# umask so the file never exists with a wider mode, then chmod, then moved
# into place. Owned by root when run as root.
cert_put() {
  local src="$1" dest="$2" mode="$3" mask=022
  [ "$mode" != 0600 ] || mask=077
  rm -f "$dest.tmp" || return 1
  ( umask "$mask"; cat "$src" > "$dest.tmp" ) || return 1
  chmod "$mode" "$dest.tmp" || return 1
  [ "$(id -u)" != 0 ] || chown root:root "$dest.tmp" || return 1
  mv -f "$dest.tmp" "$dest"
}

# Puts the backups of one run back; a file that had no backup is removed.
cert_restore() {
  local stamp="$1" ext src bak
  for ext in crt key; do
    src="$CERT_DIR/$CERT_NAME.$ext"
    bak="$src.bak.$stamp"
    if [ -f "$bak" ]; then
      cp -p "$bak" "$src" && printf '   restored %s\n' "$src"
    else
      rm -f "$src" && printf '   removed %s (there was none before)\n' "$src"
    fi
  done
}

# Rewrites certificate.json from the installed files. $1 is the run that
# installed them; a refresh without one keeps the run recorded for the
# same certificate.
cert_write_status() {
  local run_id="${1:-}" crt="$CERT_DIR/$CERT_NAME.crt" tmp_file="$CERT_STATUS_FILE.tmp" now
  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  mkdir -p "$(dirname "$CERT_STATUS_FILE")"
  if [ ! -f "$crt" ]; then
    printf '{\n  "installed": false,\n  "checked_at": "%s"\n}\n' "$now" > "$tmp_file" && mv -f "$tmp_file" "$CERT_STATUS_FILE"
    return 0
  fi
  local fp end end_epoch days hosts_json="" host previous_fp previous_run run_json
  fp="$(cert_fingerprint "$crt")"
  if [ -z "$run_id" ] && [ -f "$CERT_STATUS_FILE" ]; then
    previous_fp="$(sed -n 's/.*"fingerprint"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CERT_STATUS_FILE" | head -1)"
    previous_run="$(sed -n 's/.*"run_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CERT_STATUS_FILE" | head -1)"
    [ "$previous_fp" = "$fp" ] && run_id="$previous_run"
  fi
  end="$(cert_end_date "$crt")"
  end_epoch="$(date -u -d "$end" +%s 2>/dev/null || true)"
  if [ -n "$end_epoch" ]; then days=$(( (end_epoch - $(date -u +%s)) / 86400 )); else days=null; fi
  for host in $(cert_sans "$crt"); do
    hosts_json="$hosts_json${hosts_json:+, }\"$(cert_json_string "$host")\""
  done
  if [ -n "$run_id" ]; then run_json="\"$run_id\""; else run_json=null; fi
  cat > "$tmp_file" <<EOF
{
  "installed": true,
  "subject": "$(cert_json_string "$(cert_subject "$crt")")",
  "issuer": "$(cert_json_string "$(cert_issuer "$crt")")",
  "not_before": "$(cert_iso_date "$(cert_start_date "$crt")")",
  "not_after": "$(cert_iso_date "$end")",
  "days_left": $days,
  "hosts": [$hosts_json],
  "fingerprint": "$fp",
  "run_id": $run_json,
  "checked_at": "$now"
}
EOF
  mv -f "$tmp_file" "$CERT_STATUS_FILE"
}

# Every agent pass: the status file is rewritten when missing or older
# than CERT_STATUS_MAX_AGE_MINUTES, so the page can show the expiry.
cert_refresh_status_if_stale() {
  command -v openssl >/dev/null 2>&1 || return 0
  if [ -f "$CERT_STATUS_FILE" ] && [ -z "$(find "$CERT_STATUS_FILE" -mmin "+$CERT_STATUS_MAX_AGE_MINUTES" 2>/dev/null)" ]; then
    return 0
  fi
  cert_write_status
}

# The install itself, in a subshell: umask, trap and "exit" stay inside.
handle_certificate_request() {
  ( set -o pipefail; umask 077; cert_install_run "$1" )
}

cert_install_run() {
  local run_id="$1" zip stamp tmp files name f n index=0 key_file="" key_count=0
  local key_pub pub leaf="" c fp seen chain=() expected sans covered=0 missing="" had_backup=0 host ext src
  case "$run_id" in ''|*/*|*..*|*\\*) cert_abort "'$run_id' is not a run id" ;; esac
  zip="$RUNS_DIR/$run_id.zip"
  stamp="$(date '+%Y%m%d-%H%M%S')"
  printf '[certificate] %s on %s as %s\n' "$run_id" "$(hostname)" "$(id -un)"
  command -v openssl >/dev/null 2>&1 || cert_abort "openssl is not installed on this host"
  [ -f "$zip" ] || cert_abort "the uploaded file $zip is not on this host"
  tmp="$(mktemp -d)" || cert_abort "no temporary folder could be made"
  # The trap runs after this function's locals are gone, so it reads
  # variables of the subshell itself. The zip holds the private key: it
  # goes whatever happens.
  CERT_RUN_TMP="$tmp"
  CERT_RUN_ZIP="$zip"
  trap 'rm -rf "$CERT_RUN_TMP"; rm -f "$CERT_RUN_ZIP"' EXIT

  cert_phase "Unzipping"
  mkdir -p "$tmp/in" "$tmp/certs"
  cert_extract "$zip" "$tmp/in" || cert_abort "the zip could not be extracted (unzip, python3 or bsdtar is needed on this host)"
  files="$(find "$tmp/in" -type f ! -name '._*' | sort)"
  [ -n "$files" ] || cert_abort "the zip holds no files"
  while IFS= read -r f; do
    index=$((index + 1))
    name="$(basename "$f")"
    if openssl pkey -in "$f" -noout -passin pass:x >/dev/null 2>&1; then
      key_count=$((key_count + 1)); key_file="$f"
      printf '   %s: private key\n' "$name"
      continue
    fi
    n="$(cert_split_blocks "$f" "$tmp/certs" "$(printf '%03d' "$index")")"
    [ "$n" -gt 0 ] 2>/dev/null || cert_abort "$name holds neither a private key nor a certificate (PEM text expected; a password-protected key cannot be used)"
    printf '   %s: %s certificate(s)\n' "$name" "$n"
  done <<< "$files"
  [ "$key_count" -eq 1 ] || cert_abort "expected exactly one private key in the zip, found $key_count"

  cert_phase "Checking"
  key_pub="$(openssl pkey -in "$key_file" -pubout 2>/dev/null | tr -d '\r')"
  [ -n "$key_pub" ] || cert_abort "the public key could not be derived from the private key"
  for c in "$tmp"/certs/*.pem; do
    [ -f "$c" ] || continue
    pub="$(openssl x509 -in "$c" -noout -pubkey 2>/dev/null | tr -d '\r')"
    if [ -n "$pub" ] && [ "$pub" = "$key_pub" ]; then leaf="$c"; break; fi
  done
  [ -n "$leaf" ] || cert_abort "the private key does not match any certificate in the zip"
  seen="$(cert_fingerprint "$leaf")"
  for c in "$tmp"/certs/*.pem; do
    [ "$c" = "$leaf" ] && continue
    fp="$(cert_fingerprint "$c")"
    case " $seen " in *" $fp "*) continue ;; esac
    seen="$seen $fp"
    chain+=("$c")
  done
  [ "${#chain[@]}" -ge 1 ] || cert_abort "no CA chain in the zip: besides the site certificate there must be the intermediate certificate(s) of the issuer"
  openssl x509 -in "$leaf" -noout -checkend 0 >/dev/null 2>&1 || cert_abort "the certificate expired on $(cert_end_date "$leaf")"
  printf '   leaf:  %s\n' "$(cert_subject "$leaf")"
  printf '   chain: %s certificate(s)\n' "${#chain[@]}"
  cat "$leaf" "${chain[@]}" > "$tmp/fullchain.pem"
  cat "${chain[@]}" > "$tmp/chain.pem"
  if openssl verify -untrusted "$tmp/chain.pem" "$leaf" >/dev/null 2>&1; then
    printf '   chain verified against this host'"'"'s trust store\n'
  else
    cert_warn "the chain could not be verified against this host's trust store (a private CA, or an incomplete chain); nginx will still serve it"
  fi
  sans="$(cert_sans "$leaf" | tr '\n' ' ')"
  expected="$(cert_expected_hosts | tr '\n' ' ')"
  for host in $expected; do
    if cert_host_covered "$host" $sans; then covered=$((covered + 1)); else missing="$missing $host"; fi
  done
  if [ -n "${expected// /}" ] && [ "$covered" -eq 0 ]; then
    cert_warn "the certificate covers none of this server's hosts ($expected); its names are: ${sans:-none}"
  elif [ -n "$missing" ]; then
    printf '   not covered by this certificate:%s\n' "$missing"
  fi
  printf '\nInstalled before:\n'
  if [ -f "$CERT_DIR/$CERT_NAME.crt" ]; then cert_describe "$CERT_DIR/$CERT_NAME.crt"; else printf '   (no certificate at %s)\n' "$CERT_DIR/$CERT_NAME.crt"; fi
  printf '\nNew certificate:\n'
  cert_describe "$leaf"

  cert_phase "Installing files"
  mkdir -p "$CERT_DIR" || cert_abort "cannot create $CERT_DIR"
  for ext in crt key; do
    src="$CERT_DIR/$CERT_NAME.$ext"
    [ -f "$src" ] || continue
    cp -p "$src" "$src.bak.$stamp" || cert_abort "could not back up $src"
    had_backup=1
    printf '   backup %s\n' "$src.bak.$stamp"
  done
  if ! cert_put "$tmp/fullchain.pem" "$CERT_DIR/$CERT_NAME.crt" 0644 || ! cert_put "$key_file" "$CERT_DIR/$CERT_NAME.key" 0600; then
    cert_restore "$stamp"
    cert_abort "could not write the files into $CERT_DIR"
  fi
  printf '   wrote %s (0644, leaf + %s chain certificate(s)) and %s (0600)\n' "$CERT_DIR/$CERT_NAME.crt" "${#chain[@]}" "$CERT_DIR/$CERT_NAME.key"
  [ "$had_backup" = 1 ] || printf '   (there was no previous certificate to back up)\n'

  cert_phase "Reloading nginx"
  printf '   $ %s\n' "$NGINX_TEST"
  if ! bash -c "$NGINX_TEST" 2>&1 | sed 's/^/   | /'; then
    cert_restore "$stamp"
    bash -c "$NGINX_RELOAD" >/dev/null 2>&1 || true
    cert_abort "nginx rejected the new certificate (the configuration test failed); the previous files were restored and nginx reloaded with them"
  fi
  printf '   $ %s\n' "$NGINX_RELOAD"
  if ! bash -c "$NGINX_RELOAD" 2>&1 | sed 's/^/   | /'; then
    cert_restore "$stamp"
    bash -c "$NGINX_RELOAD" >/dev/null 2>&1 || true
    cert_abort "nginx could not be reloaded; the previous files were restored and nginx reloaded with them"
  fi
  cert_write_status "$run_id"
  printf '\nInstalled now:\n'
  cert_describe "$CERT_DIR/$CERT_NAME.crt"
  printf '\nCertificate installed. It expires on %s.\n' "$(cert_end_date "$CERT_DIR/$CERT_NAME.crt")"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -uo pipefail
  case "${1:-}" in
    --run) [ -n "${2:-}" ] || { echo "usage: $0 --run <run_id>" >&2; exit 2; }; handle_certificate_request "$2"; exit $? ;;
    --status) cert_write_status; exit $? ;;
    *) echo "usage: $0 --run <run_id> | --status" >&2; exit 2 ;;
  esac
fi
