
const Feedback = require('../../models/feedback_db.js');
const { getDepartmentIdsForHead, buildDateFilter } = require('./visitors_by_status');

/**
 * GET /department-manager/feedback
 * Get feedback for managed departments
 */
const getDepartmentFeedback = async (req, res, next) => {
    try {
        let { limit = 20, page = 1, dateFilter, rating } = req.query;

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Get department IDs for head of department
        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        // Build filter
        let filter = {
            department_id: { $in: departmentIds }
        };

        // Add rating filter if provided
        if (rating) {
            const ratingNum = parseInt(rating);
            if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 10) {
                filter.rate = ratingNum;
            }
        }

        // Add date filter if provided
        const dateFilterObj = buildDateFilter(dateFilter, 'created_date');
        if (Object.keys(dateFilterObj).length > 0) {
            Object.assign(filter, dateFilterObj);
        }

        const feedback = await Feedback.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 });

        const total_count = await Feedback.countDocuments(filter);

        // Calculate average rating
        const ratingStats = await Feedback.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    average_rating: { $avg: '$rate' },
                    total_feedback: { $sum: 1 },
                    rating_distribution: {
                        $push: '$rate'
                    }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Department feedback retrieved successfully',
            total: total_count,
            page: parseInt(page),
            limit: limit_val,
            data: feedback,
            analytics: ratingStats[0] || {
                average_rating: 0,
                total_feedback: 0,
                rating_distribution: []
            }
        });

    } catch (error) {
        console.error('Error in getDepartmentFeedback:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving feedback',
            error: error.message
        });
    }
};

module.exports = {
    getDepartmentFeedback
};