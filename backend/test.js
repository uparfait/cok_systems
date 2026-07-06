const sendLaunchInviteEmail = require('./utilities/email').sendLunchInviteEmail;

sendLaunchInviteEmail('parfaituwayo@gmail.com', "Uwayo parfait").then((result) => {
    if (result.success) {
        console.log(result);
    }
}).catch((error) => {
    console.error('Error sending lunch invite email:', error);
}
)