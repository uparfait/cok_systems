/**
 * Search Unserviced (General) Feedback Controller
 * Query unservicedfeedback_db with optional limit parameter
 */

const UnservicedFeedback = require('../../models/unservicedfeedback_db');

module.exports = async function searchUnserviced(req, res, next) {
    try {
        let { limit = 50, page = 1 } = req.query;

        const limit_val = Math.min(Math.max(1, parseInt(limit) || 50), 100); // 1..100
        const page_val = Math.max(1, parseInt(page) || 1);
        const skip_val = (page_val - 1) * limit_val;

        const feedback = await UnservicedFeedback.find({})
            .sort({ created_date: -1 })
            .limit(limit_val)
            .skip(skip_val);

        const total_count = await UnservicedFeedback.countDocuments({});

        return res.status(200).json({
            success: true,
            type: "success",
            message: "All general (unserviced) feedback results",
            total: total_count,
            page: page_val,
            data: feedback
        });

    } catch (error) {
        console.error("Error in searchUnserviced:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while searching general feedback",
            error: error.message
        });
    }
};
