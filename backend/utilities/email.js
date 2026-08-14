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

const PRIMARY_COLOR = '#056daa';
const PRIMARY_HOVER = '#248fc2';

// Official report banner (Republic of Rwanda · City of Kigali) embedded inline in
// every email via CID; falls back to the plain blue text banner if the file is missing
const LOGO_BANNER_PATH = process.env.CLIENT_URL_SET + '/LOGO_COK_report.png';
const HAS_LOGO_BANNER = require('fs').existsSync(LOGO_BANNER_PATH);
const LOGO_BANNER_CID = 'cok_header_banner';

function htmlWrapper(bodyHtml) {
    const headerHtml = HAS_LOGO_BANNER
        ? `<div style="background-color: #ffffff; text-align: center; border: 1px solid #E0E0E0; border-bottom: none; border-radius: 4px 4px 0 0;">
                <img src="${LOGO_BANNER_CID}" alt="Republic of Rwanda - City of Kigali" style="width: 100%; max-width: 600px; display: block;" />
            </div>`
        : `<div style="background-color: ${PRIMARY_COLOR}; padding: 20px; text-align: center; border-radius: 4px 4px 0 0;">
                <h2 style="color: #ffffff; margin: 0; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: -0.5px;">City of Kigali</h2>
            </div>`;
    return `
        <div style="font-family: 'Montserrat', sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #E0E0E0; border-top: none; border-radius: 0 0 4px 4px;">
                ${bodyHtml}
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #F7F9FB; border: 1px solid #E0E0E0; border-radius: 4px; text-align: center;">
                <p style="font-size: 13px; color: #9E9E9E; margin: 0; font-family: 'Montserrat', serif;">
                    City of Kigali
                </p>
            </div>
        </div>
    `;
}

async function sendOTPEmail(email, otp, type = 'login') {
    const subject = type === 'password_reset' ? 'Your Password Reset Code' : 'Your Verification Code';
    const message = `Your verification code is: ${otp}. This code will expire in 5 minutes.`;

    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: 'Montserrat', sans-serif; font-size: 22px; margin-top: 0;">${subject}</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Your verification code is:</p>
        <div style="background: #f5f5f5; padding: 15px; font-size: 28px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0; border: 2px solid ${PRIMARY_COLOR}; border-radius: 4px; color: ${PRIMARY_COLOR};">
            ${otp}
        </div>
        <p style="color: #666; font-size: 14px; font-family: 'Merriweather', serif;">This code will expire in 5 minutes.</p>
    `);

    return await sendEmail(email, subject, htmlContent, message);
}

async function sendWelcomeEmail(email, name) {
    const subject = 'Welcome to COK Systems';
    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: 'Montserrat', sans-serif;">Welcome ${name}!</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Your account has been created successfully.</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Welcome to the City of Kigali digital services platform.</p>
    `);
    return await sendEmail(email, subject, htmlContent, "Welcome to COK Systems!");
}

async function sendPasswordChangedEmail(email, name) {
    const subject = 'Password Changed - COK Systems';
    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: 'Montserrat', sans-serif;">Password Changed</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Hello ${name}, your password was updated successfully.</p>
        <p style="font-family: 'Merriweather', serif; font-size: 14px; color: #9E9E9E;">If you did not make this change, please contact support immediately.</p>
    `);
    return await sendEmail(email, subject, htmlContent, "Your password has been changed.");
}

async function sendAccountActivatedEmail(email, name) {
    const subject = 'Account Activated - COK Systems';
    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: 'Montserrat', sans-serif;">Account Activated!</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Hello ${name}, your account is now active.</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">You can now login to the City of Kigali portal with your credentials.</p>
    `);
    return await sendEmail(email, subject, htmlContent, "Your account has been activated.");
}

async function sendNegativeFeedbackAlert(email, leaderName, feedbackData) {
    const subject = `Negative Feedback Alert - ${feedbackData.department_name}`;

    const htmlContent = htmlWrapper(`
        <h2 style="color: #E53935; font-family: 'Montserrat', sans-serif;">&#9888;&#65039; Negative Feedback Alert</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Dear ${leaderName},</p>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">You have received negative feedback for <strong>${feedbackData.department_name}</strong>.</p>
        <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #E53935; border-radius: 4px;">
            <p style="margin: 0;"><strong>Rating:</strong> ${feedbackData.rating}/10</p>
            <p style="margin: 5px 0 0 0;"><strong>Visitor:</strong> ${feedbackData.user_name || 'Anonymous'}</p>
            <p style="margin: 5px 0 0 0;"><strong>Date:</strong> ${new Date(feedbackData.created_date).toLocaleString()}</p>
            <p style="margin: 5px 0 0 0;"><strong>Message:</strong></p>
            <p style="margin: 5px 0 0 0; font-style: italic; color: #555555;">${feedbackData.textmessage || 'No message provided'}</p>
        </div>
        <p style="color: #666; font-size: 14px; font-family: 'Merriweather', serif;">Please take immediate action to address this concern.</p>
    `);

    const textContent = `Negative Feedback Alert for ${feedbackData.department_name}. Rating: ${feedbackData.rating}/10. Visitor: ${feedbackData.user_name || 'Anonymous'}. Message: ${feedbackData.textmessage || 'No message'}. Please take action.`;

    return await sendEmail(email, subject, htmlContent, textContent);
}

async function sendLunchInviteEmail(email, name) {
    const subject = 'Invitation: Daily Lunch Reminder';
    const htmlContent = htmlWrapper(`
        <h2 style="color: ${PRIMARY_COLOR}; font-family: 'Montserrat', sans-serif;">Hi ${name}!</h2>
        <p style="font-family: 'Merriweather', serif; font-size: 16px; color: #555555;">Here is your daily recurring automated lunch reminder for 11:40 AM.</p>
        <p style="font-family: 'Merriweather', serif; font-size: 14px; color: #9E9E9E;">Please find the attached calendar invitation file.</p>
    `);
    const textContent = `Hi ${name}! Please accept this daily calendar invite file attachment.`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//COK Systems//Lunch Invite//EN
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
DESCRIPTION:Automated daily break reminder from COK Systems.
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
        console.log("IKAZE <coksystems@kigalicity.gov.rw>")
       const info =  await transporter.sendMail({
            from: "IKAZE <coksystems@kigalicity.gov.rw>",
            subject,
            to: toEmail,
            text: textContent,
            html: htmlContent,
            // Inline header banner referenced by cid: in htmlWrapper
            attachments: HAS_LOGO_BANNER ? [logoBannerAttachment] : [],
        });
        console.log('Email sent successfully:', info);
        return { success: true };

    } catch (error) {
        console.error('SMTP Error:', error);
        return { success: false, error: error.message };
    }
}

async function sendEmailWithFile(toEmail, subject, htmlContent, textContent, fileData) {
    try {
        const mailOptions = {
            from: "IKAZE <coksystems@kigalicity.gov.rw>",
            subject,
            to: toEmail,
            text: textContent,
            html: htmlContent,
            // Inline header banner referenced by cid: in htmlWrapper
            attachments: HAS_LOGO_BANNER ? [logoBannerAttachment] : [],
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