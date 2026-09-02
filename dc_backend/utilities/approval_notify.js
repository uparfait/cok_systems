const jwt = require("jsonwebtoken");
const config = require("../configurations/config.js");

/**
 * In-app notification bridge to the main backend. When an approver's email
 * belongs to a registered account, the main backend persists a notification
 * and delivers it live (socket to online users, web push to offline ones),
 * honoring the account's own notifications on/off setting. The main backend
 * is the only service holding the socket server and the users collection
 * write path, so dc_backend hands the notification over instead of writing
 * it itself.
 */

// Short-lived service token proving the call comes from dc_backend - both services share JWT_SECRET.
function sign_service_token() {
  return jwt.sign({ service: "dcs" }, config.jwt_secret, { expiresIn: "5m" });
}

/**
 * Asks the main backend to notify one approver in-app. Never throws;
 * returns { delivered, reason } so callers can log without failing the
 * approval flow when the main backend is unreachable.
 */
async function send_in_app_approval_notification({ email, approver_name, form_name, link, message }) {
  try {
    const response = await fetch(`${config.cok_api_url}/internal/dcs/approval-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sign_service_token()}`,
      },
      body: JSON.stringify({ email, approver_name, form_name, link, message }),
    });
    if (!response.ok) return { delivered: false, reason: `http_${response.status}` };
    const result = await response.json();
    return { delivered: !!(result && result.delivered), reason: (result && result.reason) || null };
  } catch (error) {
    console.error("In-app approval notification error:", error.message);
    return { delivered: false, reason: "unreachable" };
  }
}

module.exports = { send_in_app_approval_notification };
