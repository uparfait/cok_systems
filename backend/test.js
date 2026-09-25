/**
 * Sends one message through the configured SMTP server, to check it by
 * hand after a change to the mail settings.
 *
 *   node test.js                       to the address in EMAIL_USER
 *   node test.js someone@example.com   to somebody else
 *
 * It reads backend/.env through the same config the application uses, so
 * what it proves is the real setting and not a copy of it that can drift -
 * and so the account password is not written down here.
 */
require('dotenv').config({ quiet: true });
const nodemailer = require('nodemailer');
const config = require('../backend/configurations/config');

const recipient = process.argv[2] || config.email.user;

if (!config.email.user) {
    console.error('EMAIL_USER is not set in backend/.env. The mail server requires SMTP authentication, so there is nothing to test with.');
    process.exit(1);
}
if (!recipient) {
    console.error('No recipient. Pass one: node test.js someone@example.com');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    // Port 587 is the submission port: opened in the clear, then upgraded
    // by STARTTLS, which requireTLS makes mandatory rather than optional.
    secure: false,
    requireTLS: true,
    auth: { user: config.email.user, pass: config.email.pass },
    // The server is reached by IP, and a certificate cannot name an IP.
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
});

console.log(`Connecting to ${config.email.host}:${config.email.port} as ${config.email.user} (STARTTLS required)`);

transporter
    .verify()
    .then(() => {
        console.log('The server accepted the connection and the credentials.');
        return transporter.sendMail({
            from: config.email.from || `"IKAZE" <${config.email.user}>`,
            to: recipient,
            subject: 'IKAZE SMTP test',
            text: `Sent through ${config.email.host}:${config.email.port} at ${new Date().toISOString()}.`,
        });
    })
    .then((info) => {
        console.log(`Sent to ${recipient}. Server said: ${info.response}`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(`FAILED: ${error.message}`);
        if (error.code) console.error(`  code: ${error.code}`);
        if (error.command) console.error(`  during: ${error.command}`);
        process.exit(1);
    });
