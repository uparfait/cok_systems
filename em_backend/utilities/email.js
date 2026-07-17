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
