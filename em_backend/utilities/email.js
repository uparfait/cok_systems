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

module.exports = {
  sendCalendarEmail,
  sendEventInvitation,
  sendEventCancellation,
};
