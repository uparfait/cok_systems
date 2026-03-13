/**
 * Get Feedback by Phone Controller
 * Returns all feedback submitted by a specific phone number
 * Used for visitors to view their submitted feedback
 */

const Feedback = require('../../models/feedback_db');

module.exports = async function getByPhone(req, res, next) {
    try {
        const { telephone } = req.params;

        if (!telephone) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Phone number is required"
            });
        }

        // Find all feedback for this phone number
        const feedback = await Feedback.find({ telephone: telephone })
            .sort({ created_date: -1 }); // newest first

        if (feedback.length === 0) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "No feedback found for this phone number"
            });
        }

        // Format the response
        const formattedFeedback = feedback.map(item => ({
            feedback_id: item._id,
            department_name: item.department_name,
            department_id: item.department_id,
            provider_name: item.provider_name,
            rate: item.rate,
            rate_out_of: item.rate_out_of,
            textmessage: item.textmessage,
            created_date: item.created_date
        }));

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Feedback retrieved successfully",
            total: feedback.length,
            data: formattedFeedback
        });

    } catch (error) {
        console.error("Error in getByPhone:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving feedback",
            error: error.message
        });
    }
};