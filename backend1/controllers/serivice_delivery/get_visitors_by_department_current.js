const ServiceDelivery = require('../../models/service_delivery.js');

/**
 * Get total visitors count and details by department who are currently in house 
 * and have status not completed
 * Filter: is_still_inhouse = true AND services_status.s_type != 'Completed'
 * Return: count and visitors array by department_name
 * Param: department_id from URL params (optional)
 */
module.exports = async function get_visitors_by_department_current(req, res, next) {
    try {
        const department_id = req.params.id;

        // Build the aggregation pipeline
        const pipeline = [
            // First, match only visitors who are still in house
            {
                $match: {
                    is_still_inhouse: true
                }
            },
            // Unwind services_status array to work with individual statuses
            {
                $unwind: {
                    path: '$services_status',
                    preserveNullAndEmptyArrays: false
                }
            },
            // Match only services that are not completed
            {
                $match: {
                    'services_status.s_type': { $ne: 'Completed' }
                }
            },
            // If department_id is provided, filter by it
            ...(department_id ? [{
                $match: {
                    'services_status.department_id': department_id
                }
            }] : []),
            // Remove sensitive or unnecessary fields before grouping
            {
                $project: {
                    'password': 0, // Ensure no passwords are leaked
                    'auth': 0,     // Ensure no auth tokens are leaked
                    '__v': 0
                }
            },
            // Group by department_name and collect visitors
            {
                $group: {
                    _id: '$services_status.department_name',
                    count: { $sum: 1 },
                    // Push the entire matched document into a 'visitors' array
                    visitors: { $push: '$$ROOT' }
                }
            },
            // Sort by count descending
            {
                $sort: { count: -1 }
            },
            // Format the output
            {
                $project: {
                    _id: 0,
                    department_name: '$_id',
                    count: 1,
                    visitors: 1 // Include the visitors array in the final output
                }
            }
        ];

        const departmentData = await ServiceDelivery.aggregate(pipeline);

        // Calculate total visitors across all matched departments
        const total = departmentData.reduce((sum, item) => sum + item.count, 0);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Current visitors by department retrieved successfully',
            total_visitors: total,
            data: departmentData
        });

    } catch (error) {
        console.error("Error in get_visitors_by_department_current:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving current visitors by department",
            error: error.message
        });
    }
};