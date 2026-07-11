/**
 * Submit Unserviced Feedback Controller
 * Allows users to submit feedback without a service record or department assignment
 */

const UnservicedFeedback = require('../../models/unservicedfeedback_db');
const alertAdminsOfNegativeFeedback = require('../../services/negative_feedback_alert');

async function submitUnservicedFeedback(req, res) {
    try {
        const { telephone, user_name, rate, textmessage } = req.body;

        // Validate required fields
        if (rate === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Rating is required'
            });
        }

        // Validate rating (1-10)
        if (rate < 1 || rate > 10) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 10'
            });
        }

        // Validate textmessage max 500 characters
        if (textmessage && textmessage.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Your feedback message exceeded 500 characters'
            });
        }

        // Create feedback record
        const feedback = new UnservicedFeedback({
            telephone: telephone || '',
            user_name: user_name || '',
            textmessage: textmessage || '',
            rate: rate,
            rate_out_of: 10
        });

        await feedback.save();

        // Alert all system admins (email + in-app notification) on negative rating,
        // without blocking the response
        if (rate <= 5) {
            alertAdminsOfNegativeFeedback({
                rating: rate,
                department_name: 'General Feedback',
                user_name: user_name || 'Anonymous',
                textmessage: textmessage || '',
                created_date: feedback.created_date || new Date()
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: {
                feedback_id: feedback._id,
                rate: rate
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
