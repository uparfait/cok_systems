const STORAGE_PREFIX = "dcs_batch_session_";

/**
 * The one-day signature a batch approver receives after entering their
 * emailed code. It replaces the code on every later request, so the code
 * is never stored and never replayed.
 */
export function read_session(token) {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + token);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.signature) return null;
    if (parsed.expires_at && new Date(parsed.expires_at).getTime() <= Date.now()) {
      clear_session(token);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function save_session(token, signature, expires_at) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + token, JSON.stringify({ signature, expires_at: expires_at || null }));
  } catch {
    // storage unavailable: the approver simply re-enters the code
  }
}

export function clear_session(token) {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + token);
  } catch {
    // nothing to clean up
  }
}

export function session_headers(token) {
  const session = read_session(token);
  return session ? { "x-approval-signature": session.signature } : {};
}

/** A key that stays stable across retries of the same decision attempt. */
export function new_idempotency_key() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function is_session_error(error) {
  return !!(error && (error.signature_required || error.message_key === "APPROVAL_SESSION_INVALID"));
}
