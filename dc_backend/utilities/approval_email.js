const nodemailer = require("nodemailer");
const config = require("../configurations/config.js");

const PRIMARY_COLOR = "#056daa";
const TEXT_MUTED = "#555555";
const BORDER = "#E0E0E0";
const FONT = "'Montserrat', Arial, sans-serif";

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false,
  auth: config.email.user ? { user: config.email.user, pass: config.email.pass } : undefined,
  tls: { rejectUnauthorized: false },
});

// Same email shell as the main backend: banner image only, message below, no footer.
function html_wrapper(body_html, logo_base_url) {
  const logo_url = `${(logo_base_url || "").replace(/\/+$/, "")}/LOGO_COK_report.png`;
  return `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: ${FONT}; color: #333333;">
      <img src="${logo_url}" alt="City of Kigali" style="width: 100%; max-width: 600px; display: block;" />
      <div style="padding: 24px; border: 1px solid ${BORDER}; border-top: none;">
        ${body_html}
      </div>
    </div>
  `;
}

// Escapes user-provided text before it lands inside email HTML.
function escape_html(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

// Sends one approver their approval request link; never throws - returns {success}.
async function send_approval_request_email({ to, approver_name, approver_role, form_name, link, origin, message }) {
  const subject = `Approval requested: ${form_name}`;
  // The form author's note to this approver, when one was written while adding them.
  const message_block = message
    ? `<div style="border-left: 3px solid ${PRIMARY_COLOR}; background-color: #F7F9FB; padding: 12px 16px; margin: 0 0 12px;">
        <p style="font-size: 13px; color: ${TEXT_MUTED}; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;"><strong>Message for you</strong></p>
        <p style="font-size: 15px; color: #333333; margin: 0;">${escape_html(message)}</p>
      </div>`
    : "";
  const html = html_wrapper(
    `
    <h2 style="color: ${PRIMARY_COLOR}; font-family: ${FONT}; font-size: 22px; margin: 0 0 16px;">Approval requested</h2>
    <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">Dear ${escape_html(approver_name)} (${escape_html(approver_role)}),</p>
    <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">A response submitted to <strong>${escape_html(form_name)}</strong> is waiting for your approval.</p>
    ${message_block}
    <div style="text-align: center; margin: 24px 0;">
      <a href="${link}" style="display: inline-block; background-color: ${PRIMARY_COLOR}; color: #FFFFFF; font-family: ${FONT}; font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; text-decoration: none; padding: 14px 28px;">Review and decide</a>
    </div>
    <p style="font-size: 13px; color: ${TEXT_MUTED}; margin: 0;">Or open this link directly:</p>
    <p style="font-size: 13px; margin: 4px 0 0;"><a href="${link}" style="color: ${PRIMARY_COLOR}; word-break: break-all;">${link}</a></p>
  `,
    origin,
  );
  const text = `Dear ${approver_name} (${approver_role}), a response submitted to ${form_name} is waiting for your approval.${message ? ` Message for you: ${message}.` : ""} Open: ${link}`;

  try {
    await transporter.sendMail({ from: config.email.from, to, subject, text, html });
    return { success: true };
  } catch (error) {
    console.error("Approval email error:", error.message);
    return { success: false, error: error.message };
  }
}

// Resolves the public site origin approval links are built on - the browser's own origin when sent, else the first configured client URL.
function resolve_client_origin(req) {
  const origin = req.get && req.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  const configured = Array.isArray(config.client_url_set) ? config.client_url_set[0] : config.client_url_set;
  return (configured || "").replace(/\/+$/, "");
}

// Emails every given step its approval link; returns the steps annotated with email_sent.
// Approvers whose email belongs to a registered account also get an in-app notification
// (bell + push) through the main backend, when their account has notifications on.
async function notify_approval_steps(req, form_name, steps) {
  const { send_in_app_approval_notification } = require("./approval_notify.js");
  const origin = resolve_client_origin(req);
  const notified = [];
  for (const step of steps) {
    const link = `${origin}/dcs-approval/${step.token}`;
    // Location-routed approvers see which place they are signing for, e.g. "Village leader - Gihanga".
    const role_label = step.location && step.location.name ? `${step.role} - ${step.location.name}` : step.role;
    const result = await send_approval_request_email({
      to: step.email,
      approver_name: step.name,
      approver_role: role_label,
      form_name,
      link,
      origin,
      message: step.message || "",
    });
    const in_app = await send_in_app_approval_notification({
      email: step.email,
      approver_name: step.name,
      form_name,
      link,
      message: step.message || "",
    });
    notified.push({
      level: step.level,
      name: step.name,
      role: step.role,
      email: step.email,
      email_sent: result.success,
      in_app_sent: in_app.delivered,
      token: step.token,
    });
  }
  return notified;
}

module.exports = { send_approval_request_email, notify_approval_steps, resolve_client_origin };
