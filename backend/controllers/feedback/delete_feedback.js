/**
 * Delete Feedback Controller
 * Delete feedback by MongoDB _id
 */

const Feedback = require('../../models/feedback_db');
const mongoose = require('mongoose');

module.exports = async function deleteFeedback(req, res, next) {
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
        // validate that feedback exists before attempting to delete
        if (!await Feedback.exists({ _id: id })) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Feedback not found"
            });
        }


        const deletedFeedback = await Feedback.findByIdAndDelete(id);

        if (!deletedFeedback) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Feedback not found"
            });
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Feedback deleted successfully",
            data: { id: deletedFeedback._id }
        });

    } catch (error) {
        console.error("Error in deleteFeedback:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while deleting feedback",
            error: error.message
        });
    }
};
