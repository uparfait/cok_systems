/**
 * Email Utility - Render & Brevo API Version
 */

const nodemailer = require('nodemailer');
const config = require('../configurations/config');

// Create SMTP transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: config.email.host || 'smtp.gmail.com',
        port: config.email.port || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: config.email.user || '',
            pass: config.email.pass || ''
        }
    });
};

/**
 * Send OTP email
 * @param {string} email - Recipient email address
 * @param {string} otp - OTP code to send
 * @param {string} type - 'login' or 'password_reset'
 * @returns {Promise<object>} - { success: boolean, error?: string }
 */
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

module.exports = {
    sendOTPEmail,
    sendWelcomeEmail,
    sendPasswordChangedEmail,
    sendAccountActivatedEmail
};
