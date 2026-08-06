/**

 * Sends transactional emails via the Brevo API, including calendar (.ics)
 * attachments for event invitations and cancellations.
 
 */

const SibApiV3Sdk = require('sib-api-v3-sdk');
const config = require('../configurations/config');
const { buildInviteICS } = require('./eventCalendar');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = config.email.brevoApiKey;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const SENDER = config.email.sender;

/**
 * Send an email with a single .ics calendar attachment via Brevo.
 * @returns {Promise<{success:boolean, error?:string}>}
 */
async function sendCalendarEmail(toEmail, subject, htmlContent, textContent, icsContent, filename) {
  const mail = new SibApiV3Sdk.SendSmtpEmail();

  mail.subject = subject;
  mail.htmlContent = htmlContent;
  mail.textContent = textContent;
  mail.sender = SENDER;
  mail.to = [{ email: toEmail }];
  mail.attachment = [
    {
      content: Buffer.from(icsContent).toString('base64'),
      name: filename || 'invite.ics',
      // Critical: tells Gmail/Outlook to parse this as a calendar invitation
      contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
    },
  ];

  try {
    await apiInstance.sendTransacEmail(mail);
    return { success: true };
  } catch (error) {
    console.error('Brevo API Error:', error.response ? error.response.body : error);
    return { success: false, error: error.message };
  }
}

function inviteHtml(event) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2 style="color: #1a5276;">You're invited: ${event.eventName}</h2>
      <p>${event.eventDescription || ''}</p>
      <p><strong>Room:</strong> ${event.eventRoom || 'Meeting Room'}</p>
    </div>`;
}

function cancelHtml(event) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2 style="color: #c0392b;">Cancelled: ${event.eventName}</h2>
      <p>This event has been cancelled.</p>
    </div>`;
}

/** Send a calendar invitation to a single attendee. */
async function sendEventInvitation(email, event, invitationUid) {
  const ics = buildInviteICS(event, invitationUid, 'REQUEST', email);
  return sendCalendarEmail(
    email,
    `Invitation: ${event.eventName}`,
    inviteHtml(event),
    `Invitation: ${event.eventName}`,
    ics,
    'invite.ics'
  );
}

/** Send a calendar cancellation (METHOD:CANCEL) to a single attendee. */
async function sendEventCancellation(email, event, invitationUid) {
  const ics = buildInviteICS(event, invitationUid, 'CANCEL', email);
  return sendCalendarEmail(
    email,
    `Cancelled: ${event.eventName}`,
    cancelHtml(event),
    `Cancelled: ${event.eventName}`,
    ics,
    'cancel.ics'
  );
}

/** Send a plain transactional email (no attachment) via Brevo. */
async function sendPlainEmail(toEmail, subject, htmlContent, textContent) {
  const mail = new SibApiV3Sdk.SendSmtpEmail();

  mail.subject = subject;
  mail.htmlContent = htmlContent;
  mail.textContent = textContent;
  mail.sender = SENDER;
  mail.to = [{ email: toEmail }];

  try {
    await apiInstance.sendTransacEmail(mail);
    return { success: true };
  } catch (error) {
    console.error('Brevo API Error:', error.response ? error.response.body : error);
    return { success: false, error: error.message };
  }
}

function taskAssignmentHtml(action, eventName, tasksUrl) {
  const assignedBy = action.createdBy?.name || 'Administrator';
  const byDetails = [action.createdBy?.role, action.createdBy?.institution].filter(Boolean).join(', ');
  const due = action.dueDate
    ? new Date(action.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2 style="color: #1a5276;">New responsibility assigned to you</h2>
      <p>Hello ${action.assignedPerson?.name || ''},</p>
      <p>
        You have been assigned the responsibility <strong>"${action.title}"</strong>
        by <strong>${assignedBy}</strong>${byDetails ? ` (${byDetails})` : ''}${eventName ? ` for the event <strong>${eventName}</strong>` : ''}.
      </p>
      <p style="background: #f4f6f7; border-left: 4px solid #1a5276; padding: 10px 14px; color: #333;">
        ${action.actionDescription || ''}
      </p>
      <p><strong>Due date:</strong> ${due}</p>
      ${tasksUrl ? `
      <p style="margin-top: 20px;">
        <a href="${tasksUrl}" style="display: inline-block; background: #1a5276; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 4px;">
          Open My Tasks
        </a>
      </p>` : ''}
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 24px;">City of Kigali — Event Management System</p>
    </div>`;
}

/** Notify the assigned person that a responsibility (event action) was assigned to them. */
async function sendTaskAssignmentEmail(action, eventName) {
  const tasksUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL.replace(/\/+$/, '')}/my-tasks`
    : '';
  const assignedBy = action.createdBy?.name || 'Administrator';
  const subject = `New responsibility: ${action.title}`;
  const text = `You have been assigned "${action.title}" by ${assignedBy}.${eventName ? ` Event: ${eventName}.` : ''} Open My Tasks: ${tasksUrl}`;

  return sendPlainEmail(
    action.assignedPerson.email,
    subject,
    taskAssignmentHtml(action, eventName, tasksUrl),
    text
  );
}

module.exports = {
  sendCalendarEmail,
  sendPlainEmail,
  sendEventInvitation,
  sendEventCancellation,
  sendTaskAssignmentEmail,
};

/**

 * Sends transactional emails via the Brevo API, including calendar (.ics)
 * attachments for event invitations and cancellations.
 
 */

const SibApiV3Sdk = require('sib-api-v3-sdk');
const config = require('../configurations/config');
const { buildInviteICS } = require('./eventCalendar');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = config.email.brevoApiKey;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const SENDER = config.email.sender;

/**
 * Send an email with a single .ics calendar attachment via Brevo.
 * @returns {Promise<{success:boolean, error?:string}>}
 */
async function sendCalendarEmail(toEmail, subject, htmlContent, textContent, icsContent, filename) {
  const mail = new SibApiV3Sdk.SendSmtpEmail();

  mail.subject = subject;
  mail.htmlContent = htmlContent;
  mail.textContent = textContent;
  mail.sender = SENDER;
  mail.to = [{ email: toEmail }];
  mail.attachment = [
    {
      content: Buffer.from(icsContent).toString('base64'),
      name: filename || 'invite.ics',
      // Critical: tells Gmail/Outlook to parse this as a calendar invitation
      contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
    },
  ];

  try {
    await apiInstance.sendTransacEmail(mail);
    return { success: true };
  } catch (error) {
    console.error('Brevo API Error:', error.response ? error.response.body : error);
    return { success: false, error: error.message };
  }
}

function inviteHtml(event) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2 style="color: #1a5276;">You're invited: ${event.eventName}</h2>
      <p>${event.eventDescription || ''}</p>
      <p><strong>Room:</strong> ${event.eventRoom || 'Meeting Room'}</p>
    </div>`;
}

function cancelHtml(event) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2 style="color: #c0392b;">Cancelled: ${event.eventName}</h2>
      <p>This event has been cancelled.</p>
    </div>`;
}

/** Send a plain (no .ics attachment) transactional email via Brevo. */
async function sendNotificationEmail(toEmail, subject, htmlContent, textContent) {
  const mail = new SibApiV3Sdk.SendSmtpEmail();

  mail.subject = subject;
  mail.htmlContent = htmlContent;
  mail.textContent = textContent;
  mail.sender = SENDER;
  mail.to = [{ email: toEmail }];

  try {
    await apiInstance.sendTransacEmail(mail);
    return { success: true };
  } catch (error) {
    console.error('Brevo API Error:', error.response ? error.response.body : error);
    return { success: false, error: error.message };
  }
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bookingShell(title, bodyHtml) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; color: #1f2937;">
      <h2 style="color: #1a5276;">${escapeHtml(title)}</h2>
      ${bodyHtml}
      <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">City of Kigali &mdash; Event Management System</p>
    </div>`;
}

/**
 * Email sent to the organizer right after a room booking request is submitted.
 * Includes the tracking code and a direct link to track the request.
 */
function bookingSubmittedHtml(data) {
  const { trackingCode, trackUrl, eventName, eventRoom, start, end } = data;
  const body = `
    <p>Thank you for your room booking request. We have received it and it is now <strong>pending review</strong>.</p>
    <p><strong>Event:</strong> ${escapeHtml(eventName)}</p>
    <p><strong>Room:</strong> ${escapeHtml(eventRoom)}</p>
    <p><strong>When:</strong> ${escapeHtml(start)} &ndash; ${escapeHtml(end)}</p>
    <p style="margin-top: 16px;">Your tracking code is:</p>
    <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px; color: #1a5276;">${escapeHtml(trackingCode)}</p>
    <p style="margin-top: 16px;">You can track the status of your request (and edit or cancel it) using the link below:</p>
    <p><a href="${escapeHtml(trackUrl)}" style="color: #2563eb;">${escapeHtml(trackUrl)}</a></p>
    <p style="font-size: 13px; color: #6b7280;">Keep this code safe &mdash; you will also need it to view your request if you lose this email.</p>`;
  return bookingShell('Room Booking Request Received', body);
}

/**
 * Email sent to the organizer when their booking request is accepted.
 */
function bookingAcceptedHtml(data) {
  const { trackingCode, trackUrl, eventName, eventRoom, start, end } = data;
  const body = `
    <p>Good news! Your room booking request has been <strong style="color: #15803d;">accepted</strong>.</p>
    <p><strong>Event:</strong> ${escapeHtml(eventName)}</p>
    <p><strong>Room:</strong> ${escapeHtml(eventRoom)}</p>
    <p><strong>When:</strong> ${escapeHtml(start)} &ndash; ${escapeHtml(end)}</p>
    <p style="margin-top: 16px;">Tracking code: <strong>${escapeHtml(trackingCode)}</strong></p>
    <p style="margin-top: 16px;">Track or manage your request here:</p>
    <p><a href="${escapeHtml(trackUrl)}" style="color: #2563eb;">${escapeHtml(trackUrl)}</a></p>`;
  return bookingShell('Room Booking Request Accepted', body);
}

/**
 * Email sent to the organizer when their booking request is rejected.
 */
function bookingRejectedHtml(data) {
  const { trackingCode, trackUrl, eventName, eventRoom, reason } = data;
  const reasonBlock = reason
    ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
    : '';
  const body = `
    <p>We regret to inform you that your room booking request was <strong style="color: #b91c1c;">not approved</strong>.</p>
    <p><strong>Event:</strong> ${escapeHtml(eventName)}</p>
    <p><strong>Room:</strong> ${escapeHtml(eventRoom)}</p>
    ${reasonBlock}
    <p style="margin-top: 16px;">Tracking code: <strong>${escapeHtml(trackingCode)}</strong></p>
    <p style="margin-top: 16px;">You can review your request here:</p>
    <p><a href="${escapeHtml(trackUrl)}" style="color: #2563eb;">${escapeHtml(trackUrl)}</a></p>`;
  return bookingShell('Room Booking Request Rejected', body);
}

/** Send the "booking submitted" email to the organizer (if an email exists). */
async function sendBookingSubmittedEmail(email, data) {
  if (!email) return { success: false, error: 'No organizer email' };
  return sendNotificationEmail(
    email,
    `Room Booking Received – ${data.trackingCode}`,
    bookingSubmittedHtml(data),
    `Your room booking request (${data.trackingCode}) is pending review. Track it at ${data.trackUrl}`
  );
}

/** Send the "booking accepted" email to the organizer (if an email exists). */
async function sendBookingAcceptedEmail(email, data) {
  if (!email) return { success: false, error: 'No organizer email' };
  return sendNotificationEmail(
    email,
    `Room Booking Accepted – ${data.trackingCode}`,
    bookingAcceptedHtml(data),
    `Your room booking request (${data.trackingCode}) has been accepted. Track it at ${data.trackUrl}`
  );
}

/** Send the "booking rejected" email to the organizer (if an email exists). */
async function sendBookingRejectedEmail(email, data) {
  if (!email) return { success: false, error: 'No organizer email' };
  return sendNotificationEmail(
    email,
    `Room Booking Not Approved – ${data.trackingCode}`,
    bookingRejectedHtml(data),
    `Your room booking request (${data.trackingCode}) was rejected.${data.reason ? ` Reason: ${data.reason}` : ''} Track it at ${data.trackUrl}`
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
    'invite.ics'
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
    'cancel.ics'
  );
}

module.exports = {
  sendCalendarEmail,
  sendEventInvitation,
  sendEventCancellation,
  sendNotificationEmail,
  sendBookingSubmittedEmail,
  sendBookingAcceptedEmail,
  sendBookingRejectedEmail,
};
