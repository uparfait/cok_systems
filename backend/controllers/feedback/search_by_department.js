/**
 * Search Feedback by Department Controller
 * Query feedback_db by department_id with optional date range
 */

const Feedback = require('../../models/feedback_db');
const mongoose = require('mongoose');

module.exports = async function searchByDepartment(req, res, next) {
    try {
        const { department_id, from, to } = req.query;

        // Validate department_id is provided
        if (!department_id) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Department ID is required"
            });
        }

        // Build query object
        const query = { department_id: department_id };

        // Add date range filters if provided
        if (from || to) {
            query.created_date = {};
            
            if (from) {
                const fromDate = new Date(from);
                if (isNaN(fromDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        type: "warning",
                        message: "Invalid 'from' date format. Use YYYY-MM-DD"
                    });
                }
                query.created_date.$gte = fromDate;
            }
            
            if (to) {
                const toDate = new Date(to);
                if (isNaN(toDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        type: "warning",
                        message: "Invalid 'to' date format. Use YYYY-MM-DD"
                    });
                }
                // Set to end of day
                toDate.setHours(23, 59, 59, 999);
                query.created_date.$lte = toDate;
            }
        }

        // Execute query with sorting (newest first)
        const feedback = await Feedback.find(query)
            .sort({ created_date: -1 })
            .limit(100); // Default limit for performance

        const total_count = await Feedback.countDocuments(query);

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Feedback search results",
            total: total_count,
            data: feedback
        });

    } catch (error) {
        console.error("Error in searchByDepartment:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while searching feedback",
            error: error.message
        });
    }
};
