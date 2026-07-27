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
        console.log('SMTP Server is ready');
    }
});

const PRIMARY_COLOR = '#056daa';
const SENDER = config.email.from;

function htmlShell(title, bodyHtml) {
    return `
        <div style="font-family: 'Montserrat', sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <div style="background-color: ${PRIMARY_COLOR}; padding: 20px; text-align: center; border-radius: 4px 4px 0 0;">
                <h2 style="color: #ffffff; margin: 0; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: -0.5px;">City of Kigali</h2>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #E0E0E0; border-top: none; border-radius: 0 0 4px 4px;">
                ${bodyHtml}
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #F7F9FB; border: 1px solid #E0E0E0; border-radius: 4px; text-align: center;">
                <p style="font-size: 13px; color: #9E9E9E; margin: 0; font-family: 'Merriweather', serif;">
                    City of Kigali  Event Management System
                </p>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function sendCalendarEmail(toEmail, subject, htmlContent, textContent, icsContent, filename) {
    const mailOptions = {
        from: SENDER,
        subject,
        to: toEmail,
        text: textContent,
        html: htmlContent,
        attachments: [
            {
                content: Buffer.from(icsContent),
                filename: filename || 'invite.ics',
                contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
            },
        ],
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('SMTP Error:', error);
        return { success: false, error: error.message };
    }
}

function inviteHtml(event) {
    return `
        <h2 style="color: ${PRIMARY_COLOR}; font-family: 'Montserrat', sans-serif;">You're invited: ${event.eventName}</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">${event.eventDescription || ''}</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Room:</strong> ${event.eventRoom || 'Meeting Room'}</p>
    `;
}

function cancelHtml(event) {
    return `
        <h2 style="color: #E53935; font-family: 'Montserrat', sans-serif;">Cancelled: ${event.eventName}</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">This event has been cancelled.</p>
    `;
}

async function sendPlainEmail(toEmail, subject, htmlContent, textContent) {
    const mailOptions = {
        from: SENDER,
        subject,
        to: toEmail,
        text: textContent,
        html: htmlContent,
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('SMTP Error:', error);
        return { success: false, error: error.message };
    }
}

async function sendNotificationEmail(toEmail, subject, htmlContent, textContent) {
    return sendPlainEmail(toEmail, subject, htmlContent, textContent);
}

function bookingSubmittedHtml(data) {
    const { trackingCode, trackUrl, eventName, eventRoom, start, end } = data;
    const body = `
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Thank you for your room booking request. We have received it and it is now <strong>pending review</strong>.</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Event:</strong> ${escapeHtml(eventName)}</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Room:</strong> ${escapeHtml(eventRoom)}</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>When:</strong> ${escapeHtml(start)} &ndash; ${escapeHtml(end)}</p>
        <p style="margin-top: 16px; font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Your tracking code is:</p>
        <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px; color: ${PRIMARY_COLOR}; font-family: 'Montserrat', sans-serif;">${escapeHtml(trackingCode)}</p>
        <p style="margin-top: 16px; font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">You can track the status of your request (and edit or cancel it) using the link below:</p>
        <p><a href="${escapeHtml(trackUrl)}" style="color: #2563eb; font-family: 'Montserrat', sans-serif;">${escapeHtml(trackUrl)}</a></p>
        <p style="font-size: 13px; color: #9E9E9E; font-family: 'Merriweather', serif;">Keep this code safe  you will also need it to view your request if you lose this email.</p>
    `;
    return htmlShell('Room Booking Request Received', body);
}

function bookingAcceptedHtml(data) {
    const { trackingCode, trackUrl, eventName, eventRoom, start, end } = data;
    const body = `
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Good news! Your room booking request has been <strong style="color: #15803d;">accepted</strong>.</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Event:</strong> ${escapeHtml(eventName)}</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Room:</strong> ${escapeHtml(eventRoom)}</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>When:</strong> ${escapeHtml(start)} &ndash; ${escapeHtml(end)}</p>
        <p style="margin-top: 16px; font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Tracking code: <strong>${escapeHtml(trackingCode)}</strong></p>
        <p style="margin-top: 16px; font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Track or manage your request here:</p>
        <p><a href="${escapeHtml(trackUrl)}" style="color: #2563eb; font-family: 'Montserrat', sans-serif;">${escapeHtml(trackUrl)}</a></p>
    `;
    return htmlShell('Room Booking Request Accepted', body);
}

function bookingRejectedHtml(data) {
    const { trackingCode, trackUrl, eventName, eventRoom, reason } = data;
    const reasonBlock = reason ? `<p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : '';
    const body = `
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">We regret to inform you that your room booking request was <strong style="color: #b91c1c;">not approved</strong>.</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Event:</strong> ${escapeHtml(eventName)}</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Room:</strong> ${escapeHtml(eventRoom)}</p>
        ${reasonBlock}
        <p style="margin-top: 16px; font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Tracking code: <strong>${escapeHtml(trackingCode)}</strong></p>
        <p style="margin-top: 16px; font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">You can review your request here:</p>
        <p><a href="${escapeHtml(trackUrl)}" style="color: #2563eb; font-family: 'Montserrat', sans-serif;">${escapeHtml(trackUrl)}</a></p>
    `;
    return htmlShell('Room Booking Request Rejected', body);
}

async function sendBookingSubmittedEmail(email, data) {
    if (!email) return { success: false, error: 'No organizer email' };
    return sendPlainEmail(
        email,
        `Room Booking Received &ndash; ${data.trackingCode}`,
        bookingSubmittedHtml(data),
        `Your room booking request (${data.trackingCode}) is pending review. Track it at ${data.trackUrl}`
    );
}

async function sendBookingAcceptedEmail(email, data) {
    if (!email) return { success: false, error: 'No organizer email' };
    return sendPlainEmail(
        email,
        `Room Booking Accepted &ndash; ${data.trackingCode}`,
        bookingAcceptedHtml(data),
        `Your room booking request (${data.trackingCode}) has been accepted. Track it at ${data.trackUrl}`
    );
}

async function sendBookingRejectedEmail(email, data) {
    if (!email) return { success: false, error: 'No organizer email' };
    return sendPlainEmail(
        email,
        `Room Booking Not Approved &ndash; ${data.trackingCode}`,
        bookingRejectedHtml(data),
        `Your room booking request (${data.trackingCode}) was rejected.${data.reason ? ` Reason: ${data.reason}` : ''} Track it at ${data.trackUrl}`
    );
}

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

function taskAssignmentHtml(action, eventName, tasksUrl) {
    const assignedBy = action.createdBy?.name || 'Administrator';
    const byDetails = [action.createdBy?.role, action.createdBy?.institution].filter(Boolean).join(', ');
    const due = action.dueDate
        ? new Date(action.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '\u2014';

    const body = `
        <h2 style="color: ${PRIMARY_COLOR}; font-family: 'Montserrat', sans-serif;">New responsibility assigned to you</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Hello ${action.assignedPerson?.name || ''},</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">
            You have been assigned the responsibility <strong>"${action.title}"</strong>
            by <strong>${assignedBy}</strong>${byDetails ? ` (${byDetails})` : ''}${eventName ? ` for the event <strong>${eventName}</strong>` : ''}.
        </p>
        <p style="background: #f4f6f7; border-left: 4px solid ${PRIMARY_COLOR}; padding: 10px 14px; color: #333; font-family: 'Merriweather', serif; font-size: 15px;">
            ${action.actionDescription || ''}
        </p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;"><strong>Due date:</strong> ${due}</p>
        ${tasksUrl ? `
        <p style="margin-top: 20px;">
            <a href="${tasksUrl}" style="display: inline-block; background-color: ${PRIMARY_COLOR}; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-family: 'Montserrat', sans-serif; font-weight: 600;">
                Open My Tasks
            </a>
        </p>` : ''}
    `;
    return htmlShell('New Responsibility Assigned', body);
}

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
    sendNotificationEmail,
    sendEventInvitation,
    sendEventCancellation,
    sendTaskAssignmentEmail,
    sendBookingSubmittedEmail,
    sendBookingAcceptedEmail,
    sendBookingRejectedEmail,
};