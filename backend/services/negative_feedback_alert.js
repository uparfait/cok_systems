/**
 * Negative Feedback Alert Service
 * When a negative rating (5/10 or below) is submitted, alerts every system admin:
 *  - saves a persistent in-app notification (shown in their account)
 *  - pushes a real-time socket notification to their private room
 *  - sends an email alert
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
        const admins = await User.find({ 'roles.role_name': { $regex: /admin/i } });

        if (!admins.length) {
            console.log('Negative feedback alert: no admin accounts found to notify');
            return;
        }

        const source = feedbackData.department_name || 'General Feedback';
        const title = `Negative Feedback Alert - ${source}`;
        const message = `${feedbackData.user_name || 'Anonymous'} rated ${source} ${feedbackData.rating}/10.` +
            (feedbackData.textmessage ? ` Message: "${feedbackData.textmessage}"` : '');

        for (const admin of admins) {
            // 1. Persistent in-app notification (visible in the admin's account)
            try {
                await Notification.create({
                    user: admin._id,
                    type: 'negative_feedback',
                    title,
                    message
                });
            } catch (notifError) {
                console.error(`Failed to create in-app notification for admin ${admin.email}:`, notifError);
            }

            // 2. Real-time push to the admin's private socket room
            if (global.WebsocketIO) {
                global.WebsocketIO.to(`PRIVATE_ROOM_${admin._id}`).emit('notifications', {
                    title,
                    message
                });
            }

            // 3. Email alert
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
