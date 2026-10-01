/**
 * Submit Feedback Controller
 * Allows users to submit feedback for their assigned departments
 */

const Feedback = require('../../models/feedback_db');
const Department = require('../../models/department');
const User = require('../../models/user');
const { sendNegativeFeedbackAlert } = require('../../utilities/email');
const alertAdminsOfNegativeFeedback = require('../../services/negative_feedback_alert');
const { clean, isDuplicateKey } = require('../../utilities/visitors');
const { phoneForms, visitorByPhone, latestAssignment, hasVisits } = require('./phone_visits');

const ALREADY_SUBMITTED = {
    success: false,
    error: 'Feedback already submitted',
    message: 'You have already submitted feedback for this department. You can only provide feedback once per department.'
};

async function submitFeedback(req, res) {
    try {
        const { telephone, department_id, rate, textmessage } = req.body || {};
        const typedPhone = clean(telephone);
        const departmentId = clean(department_id);

        // Validate required fields
        if (!typedPhone || !departmentId || rate === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Phone number, department ID, and rating are required'
            });
        }

        // Validate rating (1-10)
        const rating = Number(rate);
        if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 10'
            });
        }

        // Validate text message max 1000 characters
        const message = textmessage === undefined || textmessage === null ? '' : String(textmessage).trim();
        if (message.length > 1000) {
            return res.status(400).json({
                success: false,
                error: 'Your feedback message exceeded 1000 characters'
            });
        }

        // The visitor holding this phone number, and the latest time one of
        // their visits was sent to this department
        const visitor = await visitorByPhone(typedPhone);
        const assignedDept = visitor ? await latestAssignment(visitor._id, departmentId) : null;

        if (!assignedDept) {
            if (!visitor || !(await hasVisits(visitor._id))) {
                return res.status(404).json({
                    success: false,
                    error: 'No service record found for this phone number'
                });
            }
            return res.status(403).json({
                success: false,
                error: 'You are not assigned to this department',
                message: 'You can only provide feedback for departments you were assigned to'
            });
        }

        // Customers can only provide feedback ONCE per department, whatever
        // form the phone number was saved in
        if (await Feedback.exists({ telephone: { $in: phoneForms(typedPhone) }, department_id: departmentId })) {
            return res.status(409).json(ALREADY_SUBMITTED);
        }

        let feedback;
        try {
            feedback = await Feedback.create({
                user_name: visitor.full_name,
                telephone: visitor.telephone,
                textmessage: message,
                rate: rating,
                rate_out_of: 10,
                department_id: departmentId,
                department_name: assignedDept.department_name,
                provider_name: assignedDept.provider_name
            });
        } catch (error) {
            // A second submit of the same feedback arriving at the same time
            if (isDuplicateKey(error)) return res.status(409).json(ALREADY_SUBMITTED);
            throw error;
        }

        global.WebsocketIO?.emit('feedback_submitted', {
            feedback_id: feedback._id,
            department_id: departmentId,
            department_name: assignedDept.department_name,
            rate: rating,
        });

        // Send email notification to department head if rating is 5 or below (negative feedback)
        if (rating <= 5) {
            try {
                // Find the department to get the department leader
                const department = await Department.findOne({ department_id: departmentId });

                if (department && department.department_leader) {
                    // Get the department head's information
                    const departmentHead = await User.findById(department.department_leader);

                    if (departmentHead && departmentHead.email) {
                        // Send negative feedback alert email
                        await sendNegativeFeedbackAlert(
                            departmentHead.email,
                            departmentHead.full_name,
                            {
                                rating: rating,
                                department_name: assignedDept.department_name,
                                user_name: visitor.full_name,
                                textmessage: message,
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

            // Alert all system admins (email + in-app notification), without blocking the response
            alertAdminsOfNegativeFeedback({
                rating: rating,
                department_name: assignedDept.department_name,
                user_name: visitor.full_name,
                textmessage: message,
                created_date: feedback.created_date
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Thank you for sharing your thoughts with us. We will review your comments and use them to improve.',
            data: {
                feedback_id: feedback._id,
                department_name: assignedDept.department_name,
                rate: rating
            }
        });

    } catch (error) {
        console.error('Error submitting feedback:', error);
        return res.status(500).json({
            success: false,
            error: 'This happens! wait for a moment we will get everything ok, come back in future.'
        });
    }
}

module.exports = submitFeedback;
