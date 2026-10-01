/**
 * Negative Feedback Alert Service
 * When a negative rating (5/10 or below) is submitted, alerts every system admin:
 *  - saves a persistent in-app notification (shown in their account)
 *  - pushes a real-time socket notification to their private room
 *  - sends an email alert
 * Every admin is notified in-app first; the emails follow one after the
 * other (each one waits for the slow SMTP sign-in), so no in-app alert waits
 * behind someone else's email.
 * Failures are logged and never block the feedback submission.
 */

const User = require('../models/user');
const Notification = require('../models/notification');
const { sendNegativeFeedbackAlert } = require('../utilities/email');

/**
 * Alert all admins about a negative feedback submission
 * @param {object} feedbackData - { rating, department_name, user_name, textmessage, created_date }
 */
async function alertAdminsOfNegativeFeedback(feedbackData) {
    try {
        // Match "System Admin", "Admin", "Super Admin", etc.
        const admins = await User.find({ 'roles.role_name': { $regex: /admin/i } })
            .select('_id email full_name')
            .lean();

        if (!admins.length) {
            console.log('Negative feedback alert: no admin accounts found to notify');
            return;
        }

        const source = feedbackData.department_name || 'General Feedback';
        const title = `Negative Feedback Alert - ${source}`;
        const message = `${feedbackData.user_name || 'Anonymous'} rated ${source} ${feedbackData.rating}/10.` +
            (feedbackData.textmessage ? ` Message: "${feedbackData.textmessage}"` : '');

        // 1. Persistent in-app notifications (visible in each admin's account), in one write
        try {
            await Notification.insertMany(
                admins.map((admin) => ({ user: admin._id, type: 'negative_feedback', title, message })),
                { ordered: false }
            );
        } catch (notifError) {
            console.error('Failed to create in-app notifications for admins:', notifError);
        }

        // 2. Real-time push to each admin's private socket room
        if (global.WebsocketIO) {
            admins.forEach((admin) => {
                global.WebsocketIO.to(`PRIVATE_ROOM_${admin._id}`).emit('notifications', {
                    title,
                    message
                });
            });
        }

        // 3. Email alerts
        for (const admin of admins) {
            if (admin.email) {
                try {
                    await sendNegativeFeedbackAlert(admin.email, admin.full_name, {
                        rating: feedbackData.rating,
                        department_name: source,
                        user_name: feedbackData.user_name,
                        textmessage: feedbackData.textmessage,
                        created_date: feedbackData.created_date
                    });
                    console.log(`Negative feedback alert email sent to admin ${admin.email}`);
                } catch (emailError) {
                    console.error(`Failed to send negative feedback email to admin ${admin.email}:`, emailError);
                }
            }
        }
    } catch (error) {
        console.error('Failed to alert admins of negative feedback:', error);
    }
}

module.exports = alertAdminsOfNegativeFeedback;
