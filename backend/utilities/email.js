/**
 * Email Utility - Render & Brevo API Version
 */

const nodemailer = require('nodemailer');
const fs = require('fs').promises; // Built-in Node.js module to handle files
const path = require('path');
const config = require('../configurations/config');

// Create SMTP transporter
const createTransporter = () => {
    const transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: false, // true for 465, false for other ports
        auth: {
            user: config.email.user,
            pass: config.email.pass
        },
        tls: {
            rejectUnauthorized: false
        }
    });
    // Verify connection on creation
    transporter.verify((error, success) => {
        if (error) {
            console.error('SMTP Connection Error:', error);
        } else {
            console.log('SMTP Server is ready');
        }
    });
    
    return transporter;
};

/**
 * Send OTP email
 * @param {string} email - Recipient email address
 * @param {string} otp - OTP code to send
 * @param {string} type - 'login' or 'password_reset'
 * @returns {Promise<object>} - { success: boolean, error?: string }
 */
const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;

// Authenticate with your API Key
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = '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';

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Core function to send via Brevo API
 */
const sendViaAPI = async (toEmail, subject, htmlContent, textContent) => {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.textContent = textContent;
    // The sender email MUST be verified Brevo dashboard
    sendSmtpEmail.sender = { "name": "COK Systems", "email": "cokservicedelivery@gmail.com" };
    sendSmtpEmail.to = [{ "email": toEmail }];

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        return { success: true };
    } catch (error) {
        console.error('Brevo API Error:', error.response ? error.response.body : error);
        return { success: false, error: error.message };
    }
};
const sendWithFile = async (toEmail, subject, htmlContent, textContent, fileData) => {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.textContent = textContent;
    sendSmtpEmail.sender = { "name": "COK Systems", "email": "cokservicedelivery@gmail.com" };
    sendSmtpEmail.to = [{ "email": toEmail }];

    // CRITICAL: Check if a file was provided, and format it for Brevo's API
    if (fileData && fileData.content) {
        sendSmtpEmail.attachment = [{
            // Brevo requires the file buffer to be converted into a Base64 string
            "content": fileData.content.toString('base64'), 
            "name": fileData.filename || 'Eat.ics'
        }];
    }

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        return { success: true };
    } catch (error) {
        console.error('Brevo API Error:', error.response ? error.response.body : error);
        return { success: false, error: error.message };
    }
};

const sendOTPEmail = async (email, otp, type = 'login') => {
    let subject = 'Your Verification Code';
    let message = `Your verification code is: ${otp}. This code will expire in 5 minutes.`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #333;">${subject}</h2>
            <p>Your verification code is:</p>
            <div style="background: #f5f5f5; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
                ${otp}
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 5 minutes.</p>
        </div>
    `;

    return await sendViaAPI(email, subject, htmlContent, message);
};

const sendWelcomeEmail = async (email, name) => {
    const subject = 'Welcome to COK Systems';
    const htmlContent = `<h2>Welcome ${name}!</h2><p>Your account has been created successfully.</p>`;
    return await sendViaAPI(email, subject, htmlContent, "Welcome to COK Systems!");
};

const sendPasswordChangedEmail = async (email, name) => {
    const subject = 'Password Changed - COK Systems';
    const htmlContent = `<h2>Password Changed</h2><p>Hello ${name}, your password was updated.</p>`;
    return await sendViaAPI(email, subject, htmlContent, "Your password has been changed.");
};

const sendAccountActivatedEmail = async (email, name) => {
    const subject = 'Account Activated - COK Systems';
    const htmlContent = `<h2>Account Activated!</h2><p>Hello ${name}, your account is now active.</p>`;
    return await sendViaAPI(email, subject, htmlContent, "Your account has been activated.");
};

/**
 * Send negative feedback alert email to department head
 * @param {string} email - Recipient email address (department head)
 * @param {string} leaderName - Department head's name
 * @param {object} feedbackData - Feedback details { rating, department_name, user_name, textmessage, created_date }
 * @returns {Promise<object>} - { success: boolean, error?: string }
 */
const sendNegativeFeedbackAlert = async (email, leaderName, feedbackData) => {
    const subject = `⚠️ Negative Feedback Alert - ${feedbackData.department_name}`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #d9534f;">⚠️ Negative Feedback Alert</h2>
            <p>Dear ${leaderName},</p>
            <p>You have received negative feedback for <strong>${feedbackData.department_name}</strong>.</p>
            <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #d9534f;">
                <p><strong>Rating:</strong> ${feedbackData.rating}/10</p>
                <p><strong>Visitor:</strong> ${feedbackData.user_name || 'Anonymous'}</p>
                <p><strong>Date:</strong> ${new Date(feedbackData.created_date).toLocaleString()}</p>
                <p><strong>Message:</strong></p>
                <p>${feedbackData.textmessage || 'No message provided'}</p>
            </div>
            <p style="color: #666;">Please take immediate action to address this concern.</p>
        </div>
    `;
    
    const textContent = `Negative Feedback Alert for ${feedbackData.department_name}. Rating: ${feedbackData.rating}/10. Visitor: ${feedbackData.user_name || 'Anonymous'}. Message: ${feedbackData.textmessage || 'No message'}. Please take action.`;
    
    return await sendViaAPI(email, subject, htmlContent, textContent);
};


const  sendLunchInviteEmail = async (email, name) => {
    const subject = 'Invitation: Daily Lunch Reminder 🍲';
    const htmlContent = `<h2>Hi ${name}!</h2><p>Here is your daily recurring automated lunch reminder for 11:40 AM.</p>`;
    const textContent = `Hi ${name}! Please accept this daily calendar invite file attachment.`;

    // 1. Define the structural iCalendar data
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
SUMMARY:Time to Eat! 🍲
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

    // 2. Define where to temporarily save the file on your server disk
    const filePath = path.join(__dirname, 'Eat.ics');

    try {
        // 3. WRITE: Save the string into an actual physical .ics file on disk
        await fs.writeFile(filePath, icsContent, 'utf8');
        console.log('File successfully generated and saved to server storage.');

        // 4. READ: Load the physical file back into memory as a buffer/file object
        const fileBuffer = await fs.readFile(filePath);

        // 5. SEND: Forward the loaded file stream data to your existing email API
        const apiResponse = await sendWithFile(
            email, 
            subject, 
            htmlContent, 
            textContent,
            {
                filename: 'Eat.ics',
                content: fileBuffer, // This is now sent as raw file data, not text
                contentType: 'text/calendar; charset=UTF-8; method=REQUEST'
            }
        );

        // 6. CLEAN UP (Optional): Delete the file from the server after sending to save space
        //await fs.unlink(filePath);
        
        return apiResponse;

    } catch (error) {
        console.error('Error during calendar file operations:', error);
        throw error;
    }
};


module.exports = {
    sendOTPEmail,
    sendWelcomeEmail,
    sendPasswordChangedEmail,
    sendAccountActivatedEmail,
    sendNegativeFeedbackAlert,
    sendLunchInviteEmail
};
