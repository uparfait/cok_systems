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
                message: "Please Enter a phone number"
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

        // Get service record to find all assigned departments
        const ServiceDelivery = require('../../models/service_delivery');
        const serviceRecord = await ServiceDelivery.findOne({ telephone: telephone });

        // Determine which assigned departments have feedback and which are pending
        const assignedDepartments = serviceRecord ? serviceRecord.departments_assigned.map(dept => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            assigned_time: dept.assigned_time,
            reached_in: dept.reached_in,
            provider_name: dept.provider_name
        })) : [];

        const feedbackDepartmentIds = new Set(feedback.map(f => f.department_id));

        const departmentsWithFeedback = assignedDepartments.filter(d => feedbackDepartmentIds.has(d.department_id));
        const pendingFeedbackDepartments = assignedDepartments.filter(d => !feedbackDepartmentIds.has(d.department_id));

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
            data: formattedFeedback,
            summary: {
                total_assigned_departments: assignedDepartments.length,
                completed_feedback: departmentsWithFeedback.length,
                pending_feedback: pendingFeedbackDepartments.length,
                departments_with_feedback: departmentsWithFeedback.map(d => ({
                    department_id: d.department_id,
                    department_name: d.department_name,
                    provider_name: d.provider_name
                })),
                pending_departments: pendingFeedbackDepartments.map(d => ({
                    department_id: d.department_id,
                    department_name: d.department_name,
                    provider_name: d.provider_name
                }))
            }
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