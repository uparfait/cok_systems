/**
 * Email Utility - Render & Brevo API Version
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
    // IMPORTANT: The sender email MUST be verified in your Brevo dashboard
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
