/**
 * Get Feedback by ID Controller
 * Find single feedback by MongoDB _id
 */

const Feedback = require('../../models/feedback_db');
const mongoose = require('mongoose');

module.exports = async function getById(req, res, next) {
    try {
        const { id } = req.params;

        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid feedback ID format"
            });
        }

        const feedback = await Feedback.findById(id);

        if (!feedback) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Feedback not found"
            });
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Feedback details",
            data: feedback
        });

    } catch (error) {
        console.error("Error in getById:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while getting feedback",
            error: error.message
        });
    }
};
