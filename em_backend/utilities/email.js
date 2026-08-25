/**
 * Sends transactional emails via SMTP (nodemailer), including calendar (.ics)
 * attachments for event invitations and cancellations.
 * Same transport pattern as backend/utilities/email.js.
 *
 * Every email is wrapped in emailShell(): a City of Kigali banner image header
 * (no text) followed by the message body. No footers or system names.
 */

const nodemailer = require('nodemailer');
const config = require('../configurations/config');
const { buildInviteICS } = require('./eventCalendar');

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('SMTP Connection Error:', error);
  } else {
    console.log('SMTP Server is ready (em_backend)');
  }
});

const EMAIL_FROM = 'IKAZE <coksystems@kigalicity.gov.rw>';

const PRIMARY = '#056daa';
const TEXT_DARK = '#333333';
const TEXT_MUTED = '#555555';
const BORDER = '#E0E0E0';
const FONT = "'Montserrat', Arial, sans-serif";

const LOGO_BASE_URL = (process.env.CLIENT_URL_SET || process.env.FRONTEND_URL || 'https://uat-ikaze.kigalicity.gov.rw').replace(/\/+$/, '');
const LOGO_URL = `${LOGO_BASE_URL}/LOGO_COK_report.png`;

/**
 * Standard shell for every outgoing email: the banner image as the ONLY header
 * content, then the message below it. No footer and no system name text.
 */
function emailShell(bodyHtml) {
  return `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: ${FONT}; color: ${TEXT_DARK};">
      <img src="${LOGO_URL}" alt="City of Kigali" style="width: 100%; max-width: 600px; display: block;" />
      <div style="padding: 24px; border: 1px solid ${BORDER}; border-top: none;">
        ${bodyHtml}
      </div>
    </div>`;
}

/**
 * Send an email with a single .ics calendar attachment.
 * The icalEvent option makes Gmail/Outlook parse it as a real invitation.
 * @returns {Promise<{success:boolean, error?:string}>}
 */
async function sendCalendarEmail(toEmail, subject, htmlContent, textContent, icsContent, filename, method = 'REQUEST') {
  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
      icalEvent: {
        filename: filename || 'invite.ics',
        method,
        content: icsContent,
      },
    });
    return { success: true };
  } catch (error) {
    console.error('SMTP Error (calendar email):', error);
    return { success: false, error: error.message };
  }
}

/** Send a plain transactional email (no attachment). */
async function sendNotificationEmail(toEmail, subject, htmlContent, textContent) {
  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error('SMTP Error (notification email):', error);
    return { success: false, error: error.message };
  }
}

// Kept as an alias — some callers use the older name
const sendPlainEmail = sendNotificationEmail;

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function locationHtml(event) {
  if (event.eventFormat === 'Virtual') {
    if (event.virtualLink) {
      return `<p style="margin: 0 0 12px;"><strong>Virtual:</strong> <a href="${escapeHtml(event.virtualLink)}" style="color: ${PRIMARY};">${escapeHtml(event.virtualLink)}</a></p>`;
    }
    if (event.virtualDescription) {
      return `<p style="margin: 0 0 12px;"><strong>Virtual:</strong> ${escapeHtml(event.virtualDescription)}</p>`;
    }
    return `<p style="margin: 0 0 12px;"><strong>Location:</strong> Virtual</p>`;
  }
  return `<p style="margin: 0 0 12px;"><strong>Location:</strong> ${escapeHtml(event.eventRoom || 'Meeting Room')}</p>`;
}

function inviteHtml(event) {
  return emailShell(`
      <h2 style="color: ${PRIMARY}; font-family: ${FONT}; margin: 0 0 16px;">You are invited: ${escapeHtml(event.eventName)}</h2>
      <p style="color: ${TEXT_MUTED}; margin: 0 0 12px;">${escapeHtml(event.eventDescription || '')}</p>
      ${locationHtml(event)}`);
}

function cancelHtml(event) {
  return emailShell(`
      <h2 style="color: ${PRIMARY}; font-family: ${FONT}; margin: 0 0 16px;">Cancelled: ${escapeHtml(event.eventName)}</h2>
      <p style="color: ${TEXT_MUTED}; margin: 0;">This event has been cancelled.</p>`);
}

function updateHtml(event) {
  const fmt = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const start = fmt(event.start);
  const end = fmt(event.end);
  return emailShell(`
      <h2 style="color: ${PRIMARY}; font-family: ${FONT}; margin: 0 0 16px;">Updated: ${escapeHtml(event.eventName)}</h2>
      <p style="color: ${TEXT_MUTED}; margin: 0 0 12px;">The details of this event have changed. Accepting this invitation updates the entry in your calendar automatically.</p>
      <p style="margin: 0 0 12px;"><strong>Time:</strong> ${start}${end ? ` to ${end}` : ''}</p>
      ${locationHtml(event)}`);
}

/**
 * Email sent to the organizer right after a room booking request is submitted.
 * Includes the tracking code and a direct link to track the request.
 */
function bookingSubmittedHtml(data) {
  const { trackingCode, trackUrl, eventName, eventRoom, start, end } = data;
  return emailShell(`
    <h2 style="color: ${PRIMARY}; font-family: ${FONT}; margin: 0 0 16px;">Room Booking Request Received</h2>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 12px;">Thank you for your room booking request. We have received it and it is now <strong>pending review</strong>.</p>
    <p style="margin: 0 0 8px;"><strong>Event:</strong> ${escapeHtml(eventName)}</p>
    <p style="margin: 0 0 8px;"><strong>Location:</strong> ${escapeHtml(eventRoom)}</p>
    <p style="margin: 0 0 8px;"><strong>When:</strong> ${escapeHtml(start)} to ${escapeHtml(end)}</p>
    <p style="margin: 16px 0 8px;">Your tracking code is:</p>
    <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px; color: ${PRIMARY}; margin: 0 0 8px;">${escapeHtml(trackingCode)}</p>
    <p style="margin: 16px 0 8px;">You can track the status of your request (and edit or cancel it) using the link below:</p>
    <p style="margin: 0 0 8px;"><a href="${escapeHtml(trackUrl)}" style="color: ${PRIMARY};">${escapeHtml(trackUrl)}</a></p>
    <p style="font-size: 13px; color: ${TEXT_MUTED}; margin: 16px 0 0;">Keep this code safe. You will also need it to view your request if you lose this email.</p>`);
}

/** Email sent to the organizer when their booking request is accepted. */
function bookingAcceptedHtml(data) {
  const { trackingCode, trackUrl, eventName, eventRoom, start, end } = data;
  return emailShell(`
    <h2 style="color: ${PRIMARY}; font-family: ${FONT}; margin: 0 0 16px;">Room Booking Request Accepted</h2>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 12px;">Your room booking request has been <strong style="color: #15803d;">accepted</strong>.</p>
    <p style="margin: 0 0 8px;"><strong>Event:</strong> ${escapeHtml(eventName)}</p>
    <p style="margin: 0 0 8px;"><strong>Location:</strong> ${escapeHtml(eventRoom)}</p>
    <p style="margin: 0 0 8px;"><strong>When:</strong> ${escapeHtml(start)} to ${escapeHtml(end)}</p>
    <p style="margin: 16px 0 8px;">Tracking code: <strong>${escapeHtml(trackingCode)}</strong></p>
    <p style="margin: 16px 0 8px;">Track or manage your request here:</p>
    <p style="margin: 0;"><a href="${escapeHtml(trackUrl)}" style="color: ${PRIMARY};">${escapeHtml(trackUrl)}</a></p>`);
}

/** Email sent to the organizer when their booking request is rejected. */
function bookingRejectedHtml(data) {
  const { trackingCode, trackUrl, eventName, eventRoom, reason } = data;
  const reasonBlock = reason
    ? `<p style="margin: 0 0 8px;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
    : '';
  return emailShell(`
    <h2 style="color: ${PRIMARY}; font-family: ${FONT}; margin: 0 0 16px;">Room Booking Request Not Approved</h2>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 12px;">We regret to inform you that your room booking request was <strong style="color: #b91c1c;">not approved</strong>.</p>
    <p style="margin: 0 0 8px;"><strong>Event:</strong> ${escapeHtml(eventName)}</p>
    <p style="margin: 0 0 8px;"><strong>Location:</strong> ${escapeHtml(eventRoom)}</p>
    ${reasonBlock}
    <p style="margin: 16px 0 8px;">Tracking code: <strong>${escapeHtml(trackingCode)}</strong></p>
    <p style="margin: 16px 0 8px;">You can review your request here:</p>
    <p style="margin: 0;"><a href="${escapeHtml(trackUrl)}" style="color: ${PRIMARY};">${escapeHtml(trackUrl)}</a></p>`);
}

/** Send the "booking submitted" email to the organizer (if an email exists). */
async function sendBookingSubmittedEmail(email, data) {
  if (!email) return { success: false, error: 'No organizer email' };
  return sendNotificationEmail(
    email,
    `Room Booking Received: ${data.trackingCode}`,
    bookingSubmittedHtml(data),
    `Your room booking request (${data.trackingCode}) is pending review. Track it at ${data.trackUrl}`
  );
}

/** Send the "booking accepted" email to the organizer (if an email exists). */
async function sendBookingAcceptedEmail(email, data) {
  if (!email) return { success: false, error: 'No organizer email' };
  return sendNotificationEmail(
    email,
    `Room Booking Accepted: ${data.trackingCode}`,
    bookingAcceptedHtml(data),
    `Your room booking request (${data.trackingCode}) has been accepted. Track it at ${data.trackUrl}`
  );
}

/** Send the "booking rejected" email to the organizer (if an email exists). */
async function sendBookingRejectedEmail(email, data) {
  if (!email) return { success: false, error: 'No organizer email' };
  return sendNotificationEmail(
    email,
    `Room Booking Not Approved: ${data.trackingCode}`,
    bookingRejectedHtml(data),
    `Your room booking request (${data.trackingCode}) was rejected.${data.reason ? ` Reason: ${data.reason}` : ''} Track it at ${data.trackUrl}`
  );
}

/**
 * Send an updated calendar invitation (same UID, bumped SEQUENCE) so the
 * attendee's calendar client (Google Calendar, Outlook, ...) replaces the
 * previously saved entry with the new schedule instead of creating a duplicate.
 */
async function sendEventUpdate(email, event, invitationUid, sequence = 1, recurrenceId = null) {
  const ics = buildInviteICS(event, invitationUid, 'REQUEST', email, sequence, recurrenceId);
  return sendCalendarEmail(
    email,
    `Updated: ${event.eventName}`,
    updateHtml(event),
    `Updated: ${event.eventName}`,
    ics,
    'update.ics',
    'REQUEST'
  );
}

/** Send a calendar invitation to a single attendee. */
async function sendEventInvitation(email, event, invitationUid, recurrenceId = null) {
  const ics = buildInviteICS(event, invitationUid, 'REQUEST', email, 0, recurrenceId);
  return sendCalendarEmail(
    email,
    `Invitation: ${event.eventName}`,
    inviteHtml(event),
    `Invitation: ${event.eventName}`,
    ics,
    'invite.ics',
    'REQUEST'
  );
}

/** Send a calendar cancellation (METHOD:CANCEL) to a single attendee. */
async function sendEventCancellation(email, event, invitationUid, recurrenceId = null) {
  const ics = buildInviteICS(event, invitationUid, 'CANCEL', email, 0, recurrenceId);
  return sendCalendarEmail(
    email,
    `Cancelled: ${event.eventName}`,
    cancelHtml(event),
    `Cancelled: ${event.eventName}`,
    ics,
    'cancel.ics',
    'CANCEL'
  );
}

function taskAssignmentHtml(action, eventName, tasksUrl) {
  const assignedBy = action.createdBy?.name || 'Administrator';
  const byDetails = [action.createdBy?.role, action.createdBy?.institution].filter(Boolean).join(', ');
  const due = action.dueDate
    ? new Date(action.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not set';

  return emailShell(`
      <h2 style="color: ${PRIMARY}; font-family: ${FONT}; margin: 0 0 16px;">New responsibility assigned to you</h2>
      <p style="color: ${TEXT_MUTED}; margin: 0 0 12px;">Hello ${escapeHtml(action.assignedPerson?.name || '')},</p>
      <p style="color: ${TEXT_MUTED}; margin: 0 0 12px;">
        You have been assigned the responsibility <strong>"${escapeHtml(action.title)}"</strong>
        by <strong>${escapeHtml(assignedBy)}</strong>${byDetails ? ` (${escapeHtml(byDetails)})` : ''}${eventName ? ` for the event <strong>${escapeHtml(eventName)}</strong>` : ''}.
      </p>
      <p style="background: #F7F9FB; border-left: 4px solid ${PRIMARY}; padding: 10px 14px; color: ${TEXT_DARK}; margin: 0 0 12px;">
        ${escapeHtml(action.actionDescription || '')}
      </p>
      <p style="margin: 0 0 12px;"><strong>Due date:</strong> ${due}</p>
      ${tasksUrl ? `
      <p style="margin: 20px 0 0;">
        <a href="${escapeHtml(tasksUrl)}" style="display: inline-block; background: ${PRIMARY}; color: #ffffff; padding: 10px 18px; text-decoration: none;">
          Open My Tasks
        </a>
      </p>` : ''}`);
}

/** Notify the assigned person that a responsibility (event action) was assigned to them. */
async function sendTaskAssignmentEmail(action, eventName) {
  const tasksUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL.replace(/\/+$/, '')}/my-tasks`
    : '';
  const assignedBy = action.createdBy?.name || 'Administrator';
  const subject = `New responsibility: ${action.title}`;
  const text = `You have been assigned "${action.title}" by ${assignedBy}.${eventName ? ` Event: ${eventName}.` : ''} Open My Tasks: ${tasksUrl}`;

  return sendNotificationEmail(
    action.assignedPerson.email,
    subject,
    taskAssignmentHtml(action, eventName, tasksUrl),
    text
  );
}

module.exports = {
  emailShell,
  sendCalendarEmail,
  sendPlainEmail,
  sendNotificationEmail,
  sendEventInvitation,
  sendEventUpdate,
  sendEventCancellation,
  sendTaskAssignmentEmail,
  sendBookingSubmittedEmail,
  sendBookingAcceptedEmail,
  sendBookingRejectedEmail,
};
