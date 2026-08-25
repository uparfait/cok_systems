const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const config = require('../configurations/config');

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

transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Connection Error:', error);
    } else {
        console.log('SMTP Server is ready');
    }
});

const EMAIL_FROM = 'IKAZE <coksystems@kigalicity.gov.rw>';

const PRIMARY_COLOR = '#056daa';
const TEXT_MUTED = '#555555';
const BORDER = '#E0E0E0';
const FONT = "'Montserrat', Arial, sans-serif";

// Official banner (Republic of Rwanda / City of Kigali) served from the frontend
const LOGO_BASE_URL = (process.env.CLIENT_URL_SET || process.env.FRONTEND_URL || 'https://uat-ikaze.kigalicity.gov.rw').replace(/\/+$/, '');
const LOGO_URL = `${LOGO_BASE_URL}/LOGO_COK_report.png`;

// Standard shell for every outgoing email: the banner image as the ONLY header
// content, then the message below it. No footer and no system name text.
function htmlWrapper(bodyHtml) {
    return `
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: ${FONT}; color: #333333;">
            <img src="${LOGO_URL}" alt="City of Kigali" style="width: 100%; max-width: 600px; display: block;" />
            <div style="padding: 24px; border: 1px solid ${BORDER}; border-top: none;">
                ${bodyHtml}
            </div>
        </div>
    `;
}

async function sendOTPEmail(email, otp, type = 'login') {
    const subject = type === 'password_reset' ? 'Your Password Reset Code' : 'Your Verification Code';
    const message = `Your verification code is: ${otp}. This code will expire in 5 minutes.`;

    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: ${FONT}; font-size: 22px; margin: 0 0 16px;">${subject}</h2>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">Your verification code is:</p>
        <div style="background: #F7F9FB; padding: 15px; font-size: 28px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0; border: 2px solid ${PRIMARY_COLOR}; color: ${PRIMARY_COLOR};">
            ${otp}
        </div>
        <p style="color: ${TEXT_MUTED}; font-size: 14px; margin: 0;">This code will expire in 5 minutes.</p>
    `);

    return await sendEmail(email, subject, htmlContent, message);
}

async function sendWelcomeEmail(email, name) {
    const subject = 'Welcome';
    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: ${FONT}; margin: 0 0 16px;">Welcome ${name}!</h2>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">Your account has been created successfully.</p>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0;">Welcome to the City of Kigali digital services.</p>
    `);
    return await sendEmail(email, subject, htmlContent, 'Welcome! Your account has been created successfully.');
}

async function sendPasswordChangedEmail(email, name) {
    const subject = 'Password Changed';
    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: ${FONT}; margin: 0 0 16px;">Password Changed</h2>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">Hello ${name}, your password was updated successfully.</p>
        <p style="font-size: 14px; color: ${TEXT_MUTED}; margin: 0;">If you did not make this change, please contact support immediately.</p>
    `);
    return await sendEmail(email, subject, htmlContent, 'Your password has been changed.');
}

async function sendAccountActivatedEmail(email, name) {
    const subject = 'Account Activated';
    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: ${FONT}; margin: 0 0 16px;">Account Activated</h2>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">Hello ${name}, your account is now active.</p>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0;">You can now login to the City of Kigali portal with your credentials.</p>
    `);
    return await sendEmail(email, subject, htmlContent, 'Your account has been activated.');
}

async function sendNegativeFeedbackAlert(email, leaderName, feedbackData) {
    const subject = `Negative Feedback Alert: ${feedbackData.department_name}`;

    const htmlContent = htmlWrapper(`
        <h2 style="color: #E53935; font-family: ${FONT}; margin: 0 0 16px;">Negative Feedback Alert</h2>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">Dear ${leaderName},</p>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">You have received negative feedback for <strong>${feedbackData.department_name}</strong>.</p>
        <div style="background: #F7F9FB; padding: 15px; margin: 20px 0; border-left: 4px solid #E53935;">
            <p style="margin: 0;"><strong>Rating:</strong> ${feedbackData.rating}/10</p>
            <p style="margin: 5px 0 0 0;"><strong>Visitor:</strong> ${feedbackData.user_name || 'Anonymous'}</p>
            <p style="margin: 5px 0 0 0;"><strong>Date:</strong> ${new Date(feedbackData.created_date).toLocaleString('en-GB', { hour12: false })}</p>
            <p style="margin: 5px 0 0 0;"><strong>Message:</strong></p>
            <p style="margin: 5px 0 0 0; font-style: italic; color: ${TEXT_MUTED};">${feedbackData.textmessage || 'No message provided'}</p>
        </div>
        <p style="color: ${TEXT_MUTED}; font-size: 14px; margin: 0;">Please take immediate action to address this concern.</p>
    `);

    const textContent = `Negative Feedback Alert for ${feedbackData.department_name}. Rating: ${feedbackData.rating}/10. Visitor: ${feedbackData.user_name || 'Anonymous'}. Message: ${feedbackData.textmessage || 'No message'}. Please take action.`;

    return await sendEmail(email, subject, htmlContent, textContent);
}

async function sendLunchInviteEmail(email, name) {
    const subject = 'Invitation: Daily Lunch Reminder';
    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: ${FONT}; margin: 0 0 16px;">Hi ${name}!</h2>
        <p style="font-size: 16px; color: ${TEXT_MUTED}; margin: 0 0 12px;">Here is your daily recurring automated lunch reminder for 11:40 AM.</p>
        <p style="font-size: 14px; color: ${TEXT_MUTED}; margin: 0;">Please find the attached calendar invitation file.</p>
    `);
    const textContent = `Hi ${name}! Please accept this daily calendar invite file attachment.`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//City of Kigali//Lunch Invite//EN
METHOD:REQUEST
BEGIN:VTIMEZONE
TZID:Africa/Kigali
BEGIN:STANDARD
TZNAME:CAT
TZOFFSETFROM:+0200
TZOFFSETTO:+0200
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:lunch-reminder-${Date.now()}@coksystems.com
DTSTAMP:20260703T095100Z
DTSTART;TZID=Africa/Kigali:20260703T120000
DURATION:PT45M
RRULE:FREQ=DAILY;UNTIL=20260704T235959Z
SUMMARY:Time to Eat!
DESCRIPTION:Automated daily break reminder.
LOCATION:Kigali, Rwanda
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
BEGIN:VALARM
TRIGGER:-PT5M
ACTION:DISPLAY
DESCRIPTION:Reminder: Your lunch break starts in 5 minutes!
END:VALARM
END:VEVENT
END:VCALENDAR`.trim();

    const filePath = path.join(__dirname, 'Eat.ics');

    try {
        await fs.writeFile(filePath, icsContent, 'utf8');
        const fileBuffer = await fs.readFile(filePath);
        const apiResponse = await sendEmailWithFile(
            email, subject, htmlContent, textContent,
            { filename: 'Eat.ics', content: fileBuffer }
        );
        return apiResponse;
    } catch (error) {
        console.error('Error during calendar file operations:', error);
        throw error;
    }
}

async function sendEmail(toEmail, subject, htmlContent, textContent) {
    try {
       const info =  await transporter.sendMail({
            from: EMAIL_FROM,
            subject,
            to: toEmail,
            text: textContent,
            html: htmlContent,
        });
        console.log('Email sent successfully:', info?.messageId || '');
        return { success: true };

    } catch (error) {
        console.error('SMTP Error:', error);
        return { success: false, error: error.message };
    }
}

async function sendEmailWithFile(toEmail, subject, htmlContent, textContent, fileData) {
    try {
        const mailOptions = {
            from: EMAIL_FROM,
            subject,
            to: toEmail,
            text: textContent,
            html: htmlContent,
            attachments: [],
        };

        if (fileData && fileData.content) {
            mailOptions.attachments.push({
                content: fileData.content,
                filename: fileData.filename || 'Eat.ics',
                contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
            });
        }

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('SMTP Error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendOTPEmail,
    sendWelcomeEmail,
    sendPasswordChangedEmail,
    sendAccountActivatedEmail,
    sendNegativeFeedbackAlert,
    sendLunchInviteEmail,
};
