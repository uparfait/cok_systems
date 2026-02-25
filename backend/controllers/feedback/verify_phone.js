
//   Verify Phone Controller
//   Verifies if phone number exists in service delivery and returns assigned departments
 

const ServiceDelivery = require('../../models/service_delivery');

async function verifyPhone(req, res) {
    try {
        const { telephone } = req.body;

        if (!telephone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // Find service record by phone number
        const serviceRecord = await ServiceDelivery.findOne({ telephone });

        if (!serviceRecord) {
            return res.status(404).json({
                success: false,
                error: 'No service record found for this phone number',
                message: 'You must have received service to provide feedback'
            });
        }

        // Get assigned departments
        const assignedDepartments = serviceRecord.departments_assigned.map(dept => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            assigned_time: dept.assigned_time,
            reached_in: dept.reached_in,
            provider_name: dept.provider_name
        }));

        return res.status(200).json({
            success: true,
            message: 'Phone verified successfully',
            data: {
                visitor_name: serviceRecord.full_name,
                telephone: serviceRecord.telephone,
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
