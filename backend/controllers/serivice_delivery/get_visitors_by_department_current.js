const ServiceDelivery = require('../../models/service_delivery.js');

/**
 * Get total visitors count and details by department who are currently in house 
 * and have status not completed
 * Filter: is_still_inhouse = true AND services_status.s_type != 'Completed'
 * Includes visitors with no department assignment in an "Unassigned" group
 * Return: count and visitors array by department_name
 * Param: department_id from URL params (optional)
 */
module.exports = async function get_visitors_by_department_current(req, res, next) {
    try {
        const department_id = req.params.id;

        // Build the aggregation pipeline
        const pipeline = [
            // First, filter only in-house visitors
            {
                $match: {
                    is_still_inhouse: true
                }
            },
            // Handle empty/null services_status by adding a placeholder
            {
                $addFields: {
                    services_status: {
                        $cond: {
                            if: {
                                $or: [
                                    { $eq: ['$services_status', null] },
                                    { $not: ['$services_status'] },
                                    { $eq: [{ $size: { $ifNull: ['$services_status', []] } }, 0] }
                                ]
                            },
                            then: [{
                                department_id: 'unassigned',
                                department_name: 'Unassigned',
                                s_type: 'Pending'
                            }],
                            else: '$services_status'
                        }
                    }
                }
            },
            // Filter out completed services but preserve unassigned
            {
                $addFields: {
                    services_status: {
                        $filter: {
                            input: '$services_status',
                            as: 'service',
                            cond: {
                                $or: [
                                    { $eq: ['$$service.department_id', 'unassigned'] },
                                    { $ne: ['$$service.s_type', 'Completed'] }
                                ]
                            }
                        }
                    }
                }
            },
            // Remove documents that have no services_status after filtering
            {
                $match: {
                    'services_status.0': { $exists: true }
                }
            },
            // Unwind services_status array
            {
                $unwind: {
                    path: '$services_status',
                    preserveNullAndEmptyArrays: false
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
                    'password': 0,
                    'auth': 0,
                    '__v': 0
                }
            },
            // Group by department_name and collect visitors
            {
                $group: {
                    _id: '$services_status.department_name',
                    count: { $sum: 1 },
                    visitors: { $push: '$$ROOT' }
                }
            },
            // Sort by count descending (optional: put Unassigned at bottom)
            {
                
                    $sort: { 
                        $cond: [{ $eq: ['$_id', 'Unassigned'] }, 1, 0],
                        count: -1
                    }
                
            },
            // Format the output
            {
                $project: {
                    _id: 0,
                    department_name: '$_id',
                    count: 1,
                    visitors: 1
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