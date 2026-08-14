const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'mail.kigalicity.gov.rw',
    port: 25,
    secure: false, // true for SSL/TLS direct wrapper
    auth: {
        user: "coksystems@kigalicity.gov.rw",
        pass: "CTown@2025!&",
    },
    tls: {
        rejectUnauthorized: false, // Bypasses self-signed certificate errors if applicable
    },
});

/**
 * Sends an email using the configured Nodemailer transporter.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} [options.text] - Plain text version of the message
 * @param {string} [options.html] - HTML version of the message
 * @param {Array} [options.attachments] - Array of attachment objects
 * @returns {Promise<Object>} Nodemailer send info object
 */
async function sendEmail({ to, subject, text, html, attachments = [] }) {
    try {
        const mailOptions = {
            from: `coksystems@kigalicity.gov.rw`,
            to,
            subject,
            text,
            html,
            attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw error;
    }
}

// Example usage:

async function main() {
    await sendEmail({
    to: 'parfaituwayo@gmail.com',
    subject: 'Welcome to the Platform',
    text: 'Hello! Thank you for signing up.',
    html: '<h1>Hello!</h1><p>Thank you for signing up.</p>'
});

}
main().catch(console.error);