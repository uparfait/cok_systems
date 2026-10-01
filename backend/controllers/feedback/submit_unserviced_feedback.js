/**
 * Submit Unserviced Feedback Controller
 * Allows users to submit feedback without a service record or department assignment
 */

const UnservicedFeedback = require('../../models/unservicedfeedback_db');
const alertAdminsOfNegativeFeedback = require('../../services/negative_feedback_alert');
const { clean, normalizePhone } = require('../../utilities/visitors');

async function submitUnservicedFeedback(req, res) {
    try {
        const { telephone, user_name, rate, textmessage } = req.body || {};

        // Validate required fields
        if (rate === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Rating is required'
            });
        }

        // Validate rating (1-10)
        const rating = Number(rate);
        if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 10'
            });
        }

        // Validate textmessage max 500 characters
        const message = textmessage === undefined || textmessage === null ? '' : String(textmessage).trim();
        if (message.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Your feedback message exceeded 500 characters'
            });
        }

        // Optional contact details, saved the way the visitor registry saves them
        const name = clean(user_name) || '';
        const feedback = await UnservicedFeedback.create({
            telephone: normalizePhone(telephone) || '',
            user_name: name,
            textmessage: message,
            rate: rating,
            rate_out_of: 10
        });

        global.WebsocketIO?.emit('feedback_submitted', {
            feedback_id: feedback._id,
            department_name: 'General Feedback',
            rate: rating,
        });

        // Alert all system admins (email + in-app notification) on negative rating,
        // without blocking the response
        if (rating <= 5) {
            alertAdminsOfNegativeFeedback({
                rating: rating,
                department_name: 'General Feedback',
                user_name: name || 'Anonymous',
                textmessage: message,
                created_date: feedback.created_date || new Date()
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: {
                feedback_id: feedback._id,
                rate: rating
            }
        });

    } catch (error) {
        console.error('Error submitting unserviced feedback:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

module.exports = submitUnservicedFeedback;
