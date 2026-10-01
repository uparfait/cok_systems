
//   Verify Phone Controller
//   Finds the registered visitor holding this phone number and returns the
//   departments of their visits (latest visit first) for feedback.


const { clean } = require('../../utilities/visitors');
const { visitorByPhone, visitDepartments, hasVisits } = require('./phone_visits');

async function verifyPhone(req, res) {
    try {
        const telephone = clean((req.body || {}).telephone);

        if (!telephone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const visitor = await visitorByPhone(telephone);
        const assignedDepartments = visitor ? await visitDepartments(visitor._id) : [];

        // A visitor without any visit (a staff driver, for example) has nothing to rate
        if (!visitor || (assignedDepartments.length === 0 && !(await hasVisits(visitor._id)))) {
            return res.status(404).json({
                success: false,
                error: 'Phone number not found',
                message: 'No service record linked to this phone number'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Phone verified successfully',
            data: {
                visitor_name: visitor.full_name,
                telephone: visitor.telephone,
                assigned_departments: assignedDepartments
            }
        });

    } catch (error) {
        console.error('Error verifying phone:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

module.exports = verifyPhone;
