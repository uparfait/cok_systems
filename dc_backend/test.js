/**
 * Sends one message through the configured SMTP server, to check the mail
 * settings of THIS backend by hand. Identical copy in backend/,
 * em_backend/ and dc_backend/.
 *
 *   node test.js                       to the address in EMAIL_USER
 *   node test.js someone@example.com   to somebody else
 *
 * It goes through utilities/mail_transport.js - the same transport the
 * application uses - so what it proves is the real setting and not a copy
 * of it that can drift, and it reports WHICH way the server answered.
 */
require('dotenv').config({ quiet: true });
const path = require('path');
const config = require('./configurations/config');
const transporter = require('./utilities/mail_transport');

const service = path.basename(__dirname);
const recipient = process.argv[2] || config.email.user;

if (!config.email.user) {
    console.error(`EMAIL_USER is not set in ${service}/.env. The mail server requires SMTP authentication, so there is nothing to test with.`);
    process.exit(1);
}
if (!recipient) {
    console.error('No recipient. Pass one: node test.js someone@example.com');
    process.exit(1);
}

console.log(`${service}: ${config.email.host}:${config.email.port} as ${config.email.user}, from ${config.email.from}`);
console.log(`Asked for ${config.email.secure ? 'TLS from the first byte' : 'STARTTLS'} first; the other ways are tried if that one cannot connect.\n`);

transporter
    .sendMail({
        from: config.email.from,
        to: recipient,
        subject: `IKAZE SMTP test (${service})`,
        text: `Sent by ${service} through ${config.email.host}:${config.email.port} at ${new Date().toISOString()}.`,
    })
    .then((info) => {
        console.log(`\nSent to ${recipient}. Server said: ${info.response}`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(`\nFAILED: ${error.message}`);
        if (error.code) console.error(`  code: ${error.code}`);
        if (error.command) console.error(`  during: ${error.command}`);
        console.error('  Every way of connecting was tried; the lines above say what each one answered.');
        process.exit(1);
    });
