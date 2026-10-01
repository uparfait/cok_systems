/**
 * Search All Feedback Controller
 * Query feedback_db with optional limit parameter
 */

const Feedback = require('../../models/feedback_db');

module.exports = async function searchAll(req, res, next) {
    try {
        let { limit = 50, page = 1 } = req.query;

        // Parse and validate limit (1..100) and page (from 1)
        const limit_val = Math.min(Math.max(1, parseInt(limit) || 50), 100);
        const page_val = Math.max(1, parseInt(page) || 1);
        const skip_val = (page_val - 1) * limit_val;

        // Execute query with sorting (newest first)
        const feedback = await Feedback.find({})
            .sort({ created_date: -1 })
            .limit(limit_val)
            .skip(skip_val);

        const total_count = await Feedback.countDocuments({});

        return res.status(200).json({
            success: true,
            type: "success",
            message: "All feedback results",
            total: total_count,
            page: page_val,
            data: feedback
        });

    } catch (error) {
        console.error("Error in searchAll:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while searching feedback",
            error: error.message
        });
    }
};
