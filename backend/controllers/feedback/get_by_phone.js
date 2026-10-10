/**
 * Get Feedback by Phone Controller
 * Returns all feedback submitted by a specific phone number
 * Used for visitors to view their submitted feedback
 */

const Feedback = require('../../models/feedback_db');
const { clean } = require('../../utilities/visitors');
const { phoneForms, visitorByPhone, feedbackSummary } = require('./phone_visits');

module.exports = async function getByPhone(req, res, next) {
    try {
        const telephone = clean(req.params && req.params.telephone);

        if (!telephone) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Please Enter a phone number"
            });
        }

        // Older feedback keeps the number as it was typed, newer feedback the normalised form
        const phones = phoneForms(telephone);
        const feedback = await Feedback.aggregate([
            { $match: { telephone: { $in: phones } } },
            { $sort: { created_date: -1, _id: -1 } },
            {
                $project: {
                    _id: 0,
                    feedback_id: '$_id',
                    department_name: 1,
                    department_id: 1,
                    provider_name: 1,
                    rate: 1,
                    rate_out_of: 1,
                    textmessage: 1,
                    created_date: 1
                }
            }
        ]);

        if (feedback.length === 0) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "No feedback found for this phone number"
            });
        }

        // Departments of the visitor's visits, split into rated and pending
        const visitor = await visitorByPhone(telephone);
        const summary = await feedbackSummary(visitor ? visitor._id : null, phones);

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Feedback retrieved successfully",
            total: feedback.length,
            data: feedback,
            summary
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
