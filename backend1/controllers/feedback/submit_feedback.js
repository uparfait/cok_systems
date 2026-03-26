/**
 * Submit Feedback Controller
 * Allows users to submit feedback for their assigned departments
 */

const Feedback = require('../../models/feedback_db');
const ServiceDelivery = require('../../models/service_delivery');
const Department = require('../../models/department');
const User = require('../../models/user');
const { sendNegativeFeedbackAlert } = require('../../utilities/email');

async function submitFeedback(req, res) {
    try {
        const { telephone, department_id, rate, textmessage } = req.body;

        // Validate required fields
     if (!telephone || !department_id || rate === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Phone number, department ID, and rating are required'
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

        // Find service record by phone number
        const serviceRecord = await ServiceDelivery.findOne({ telephone });

        if (!serviceRecord) {
            return res.status(404).json({
                success: false,
                error: 'No service record found for this phone number'
            });
        }

        // Check if department is in assigned departments
        const isAssigned = serviceRecord.departments_assigned.some(
            dept => dept.department_id === department_id
        );

        if (!isAssigned) {
            return res.status(403).json({
                success: false,
                error: 'You are not assigned to this department',
                message: 'You can only provide feedback for departments you were assigned to'
            });
        }

        // Get department name from assigned departments
        const assignedDept = serviceRecord.departments_assigned.find(
            dept => dept.department_id === department_id
        );

        // Create feedback record
        const feedback = new Feedback({
            user_name: serviceRecord.full_name,
            telephone: telephone,
            textmessage: textmessage || '',
            rate: rate,
            rate_out_of: 10,
            department_id: department_id,
            department_name: assignedDept.department_name,
            provider_name: assignedDept.provider_name
        });

        await feedback.save();

        // Send email notification to department head if rating is 5 or below (negative feedback)
        if (rate <= 5) {
            try {
                // Find the department to get the department leader
                const department = await Department.findOne({ department_id: department_id });
                
                if (department && department.department_leader) {
                    // Get the department head's information
                    const departmentHead = await User.findById(department.department_leader);
                    
                    if (departmentHead && departmentHead.email) {
                        // Send negative feedback alert email
                        await sendNegativeFeedbackAlert(
                            departmentHead.email,
                            departmentHead.full_name,
                            {
                                rating: rate,
                                department_name: assignedDept.department_name,
                                user_name: serviceRecord.full_name,
                                textmessage: textmessage || '',
                                created_date: feedback.created_date
                            }
                        );
                        console.log(`Negative feedback alert sent to ${departmentHead.email} for department ${assignedDept.department_name}`);
                    }
                }
            } catch (emailError) {
                // Log email error but don't fail the feedback submission
                console.error('Failed to send negative feedback alert email:', emailError);
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: {
                feedback_id: feedback._id,
                department_name: assignedDept.department_name,
                rate: rate
            }
        });

    } catch (error) {
        console.error('Error submitting feedback:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

module.exports = submitFeedback;
