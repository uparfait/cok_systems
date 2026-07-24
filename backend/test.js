const nodemailer = require('nodemailer');

const createTransporter = () => {
    const transporter = nodemailer.createTransport({
        host: "mail.kigalicity.gov.rw",
        port: 25,
        secure: false, 
        auth: {
            user: "coksystems@kigalicity.gov.rw",
            pass: "CTown@2025!&"
        },
        tls: {
            rejectUnauthorized: false
        }
    });
    
    transporter.verify((error, success) => {
        if (error) {
            console.error('SMTP Connection Error:', error);
        } else {
            console.log('SMTP Server is ready');
        }
    });
    
    return transporter;
};


const receiver = "parfaituwayo@gmail.com"
const message = "Test SMTP email"
const Subject = "TEST"

// send a message
createTransporter().sendMail({
    from: '"IKAZE" <coksystems@kigalicity.gov.rw>',
    subject: Subject,
    to: receiver,
    text: message
    
})
