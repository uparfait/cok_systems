/**
 * Email Utility
 * Handles sending emails via SMTP for OTP and notifications
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
    const transporter = createTransporter();
    
    let subject, message;
    
    if (type === 'login') {
        subject = 'Your Login Verification Code';
        message = `Your verification code is: ${otp}. This code will expire in 5 minutes.`;
    } else if (type === 'password_reset') {
        subject = 'Your Password Reset Code';
        message = `Your password reset code is: ${otp}. This code will expire in 5 minutes.`;
    } else if (type === 'first_login') {
        subject = 'Your Account Activation Code';
        message = `Your account activation code is: ${otp}. This code will expire in 5 minutes.`;
    } else {
        subject = 'Your Verification Code';
        message = `Your verification code is: ${otp}. This code will expire in 5 minutes.`;
    }
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #333;">${subject}</h2>
            <p>Your verification code is:</p>
            <div style="background: #f5f5f5; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
                ${otp}
            </div>
            <p style="color: #666; font-size: 14px;">
                This code will expire in 5 minutes.<br>
                If you didn't request this, please ignore this email.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: config.email.from || 'cokservicedelivery@gmail.com',
            to: email,
            subject: subject,
            text: message,
            html: htmlContent
        });

        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send welcome email
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @returns {Promise<object>}
 */
const sendWelcomeEmail = async (email, name) => {
    const transporter = createTransporter();
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #333;">Welcome to COK Systems!</h2>
            <p>Hello ${name},</p>
            <p>Your account has been created successfully.</p>
            <p>Please login with your credentials and complete your profile.</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: config.email.from || '"COK Systems" <cokservicedelively@gmail.com>',
            to: email,
            subject: 'Welcome to COK Systems',
            html: htmlContent
        });

        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send password changed confirmation
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @returns {Promise<object>}
 */
const sendPasswordChangedEmail = async (email, name) => {
    const transporter = createTransporter();
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #333;">Password Changed</h2>
            <p>Hello ${name},</p>
            <p>Your password has been successfully changed.</p>
            <p style="color: #666; font-size: 14px;">
                If you didn't change your password, please contact support immediately.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: config.email.from || '"COK Systems" <noreply@coksystems.com>',
            to: email,
            subject: 'Password Changed - COK Systems',
            html: htmlContent
        });

        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send account activation confirmation email
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @returns {Promise<object>}
 */
const sendAccountActivatedEmail = async (email, name) => {
    const transporter = createTransporter();
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #333;">Account Activated!</h2>
            <p>Hello ${name},</p>
            <p>Your account has been successfully activated.</p>
            <p>You can now login to COK Systems using your email and password.</p>
            <p style="color: #666; font-size: 14px;">
                If you didn't activate this account, please contact support immediately.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: config.email.from || '"COK Systems" <noreply@coksystems.com>',
            to: email,
            subject: 'Account Activated - COK Systems',
            html: htmlContent
        });

        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendOTPEmail,
    sendWelcomeEmail,
    sendPasswordChangedEmail,
    sendAccountActivatedEmail,
    createTransporter
};
