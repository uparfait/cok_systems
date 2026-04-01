// const ServiceDelivery = require('../../models/service_delivery.js');

// /**
//  * Get total visitors count and details by department who are currently in house 
//  * and have status not completed
//  * Filter: is_still_inhouse = true AND services_status.s_type != 'Completed'
//  * Includes visitors with no department assignment in an "Unassigned" group
//  * Return: count and visitors array by department_name
//  * Param: department_id from URL params (optional)
//  * Query: page (default 1), limit (default 10, max 50)
//  */
// module.exports = async function get_visitors_by_department_current(req, res, next) {
//     try {
//         const department_id = req.params.id;
//         
//         // Get pagination parameters from query string
//         let { page = 1, limit = 10 } = req.query || {};
//         
//         // Parse and validate pagination values
//         const pageNum = Math.max(1, parseInt(page)); // Minimum page 1
//         const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Between 1 and 50
//         const skipVal = (pageNum - 1) * limitNum;

//         // Build the aggregation pipeline
//         const pipeline = [
//             // First, filter only in-house visitors
//             {
//                 $match: {
//                     is_still_inhouse: true
//                 }
//             },
//             // Handle empty/null services_status by adding a placeholder
//             {
//                 $addFields: {
//                     services_status: {
//                         $cond: {
//                             if: {
//                                 $or: [
//                                     { $eq: ['$services_status', null] },
//                                     { $not: ['$services_status'] },
//                                     { $eq: [{ $size: { $ifNull: ['$services_status', []] } }, 0] }
//                                 ]
//                             },
//                             then: [{
//                                 department_id: 'unassigned',
//                                 department_name: 'Unassigned',
//                                 s_type: 'Pending'
//                             }],
//                             else: '$services_status'
//                         }
//                     }
//                 }
//             },
//             // Filter out completed services but preserve unassigned
//             {
//                 $addFields: {
//                     services_status: {
//                         $filter: {
//                             input: '$services_status',
//                             as: 'service',
//                             cond: {
//                                 $or: [
//                                     { $eq: ['$$service.department_id', 'unassigned'] },
//                                     { $ne: ['$$service.s_type', 'Completed'] }
//                                 ]
//                             }
//                         }
//                     }
//                 }
//             },
//             // Remove documents that have no services_status after filtering
//             {
//                 $match: {
//                     'services_status.0': { $exists: true }
//                 }
//             },
//             // Unwind services_status array
//             {
//                 $unwind: {
//                     path: '$services_status',
//                     preserveNullAndEmptyArrays: false
//                 }
//             },
//             // If department_id is provided, filter by it
//             ...(department_id ? [{
//                 $match: {
//                     'services_status.department_id': department_id
//                 }
//             }] : []),
//             // Remove sensitive or unnecessary fields before grouping
//             {
//                 $project: {
//                     'password': 0,
//                     'auth': 0,
//                     '__v': 0
//                 }
//             },
//             // Group by department_name and collect visitors
//             {
//                 $group: {
//                     _id: '$services_status.department_name',
//                     count: { $sum: 1 },
//                     visitors: { $push: '$$ROOT' }
//                 }
//             },
//             // Sort with Unassigned at the bottom
//             {
//                 $sort: { 
//                     $cond: [{ $eq: ['$_id', 'Unassigned'] }, 1, 0],
//                     count: -1
//                 }
//             },
//             // Format the output
//             {
//                 $project: {
//                     _id: 0,
//                     department_name: '$_id',
//                     count: 1,
//                     visitors: 1
//                 }
//             },
//             // Add pagination stages
//             {
//                 $facet: {
//                     metadata: [
//                         { $count: "total_departments" }
//                     ],
//                     data: [
//                         { $skip: skipVal },
//                         { $limit: limitNum }
//                     ]
//                 }
//             }
//         ];

//         const result = await ServiceDelivery.aggregate(pipeline);
//         
//         // Extract data and metadata
//         const departmentData = result[0]?.data || [];
//         const totalDepartments = result[0]?.metadata[0]?.total_departments || 0;
//         
//         // Calculate total visitors across all departments (for the current page)
//         const totalVisitorsOnPage = departmentData.reduce((sum, item) => sum + item.count, 0);
//         
//         // To get total visitors across ALL departments (without pagination), we need a separate query
//         // This is more efficient than running another aggregation
//         const totalVisitorsAllQuery = [
//             // First, filter only in-house visitors
//             {
//                 $match: {
//                     is_still_inhouse: true
//                 }
//             },
//             // Handle empty/null services_status by adding a placeholder
//             {
//                 $addFields: {
//                     services_status: {
//                         $cond: {
//                             if: {
//                                 $or: [
//                                     { $eq: ['$services_status', null] },
//                                     { $not: ['$services_status'] },
//                                     { $eq: [{ $size: { $ifNull: ['$services_status', []] } }, 0] }
//                                 ]
//                             },
//                             then: [{
//                                 department_id: 'unassigned',
//                                 department_name: 'Unassigned',
//                                 s_type: 'Pending'
//                             }],
//                             else: '$services_status'
//                         }
//                     }
//                 }
//             },
//             // Filter out completed services but preserve unassigned
//             {
//                 $addFields: {
//                     services_status: {
//                         $filter: {
//                             input: '$services_status',
//                             as: 'service',
//                             cond: {
//                                 $or: [
//                                     { $eq: ['$$service.department_id', 'unassigned'] },
//                                     { $ne: ['$$service.s_type', 'Completed'] }
//                                 ]
//                             }
//                         }
//                     }
//                 }
//             },
//             // Remove documents that have no services_status after filtering
//             {
//                 $match: {
//                     'services_status.0': { $exists: true }
//                 }
//             },
//             // Unwind services_status array
//             {
//                 $unwind: {
//                     path: '$services_status',
//                     preserveNullAndEmptyArrays: false
//                 }
//             },
//             // If department_id is provided, filter by it
//             ...(department_id ? [{
//                 $match: {
//                     'services_status.department_id': department_id
//                 }
//             }] : []),
//             // Group by department_name and get counts
//             {
//                 $group: {
//                     _id: '$services_status.department_name',
//                     count: { $sum: 1 }
//                 }
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total_visitors: { $sum: '$count' }
//                 }
//             }
//         ];
//         
//         const totalResult = await ServiceDelivery.aggregate(totalVisitorsAllQuery);
//         const totalVisitorsAll = totalResult[0]?.total_visitors || 0;

//         return res.status(200).json({
//             success: true,
//             type: 'success',
//             message: 'Current visitors by department retrieved successfully',
//             pagination: {
//                 current_page: pageNum,
//                 per_page: limitNum,
//                 total_departments: totalDepartments,
//                 total_visitors: totalVisitorsAll,
//                 total_pages: Math.ceil(totalDepartments / limitNum)
//             },
//             total_visitors_on_page: totalVisitorsOnPage,
//             data: departmentData
//         });

//     } catch (error) {
//         console.error("Error in get_visitors_by_department_current:", error);
//         return res.status(500).json({
//             success: false,
//             type: "error",
//             message: "Something went wrong while retrieving current visitors by department",
//             error: error.message
//         });
//     }
// };


// ============================================================================
// NEW IMPLEMENTATION: Get ALL visitors (assigned and unassigned) for employee dashboard
// ============================================================================

const ServiceDelivery = require('../../models/service_delivery.js');

/**
 * Get ALL visitors currently in house for employee dashboard
 * This endpoint now returns:
 * 1. Visitors assigned to any department (regardless of provider)
 * 2. Unassigned visitors (those with empty services_status or no department assignment)
 * 3. Groups visitors by department (including "Unassigned" group)
 * 
 * Filter: is_still_inhouse = true
 * Includes visitors with no department assignment in an "Unassigned" group
 * Return: count and visitors array by department_name
 * Query: page (default 1), limit (default 10, max 50)
 */
module.exports = async function get_visitors_by_provider_current(req, res, next) {
    try {
        // Get pagination parameters from query string
        let { page = 1, limit = 10 } = req.query || {};
        
        // Parse and validate pagination values
        const pageNum = Math.max(1, parseInt(page)); // Minimum page 1
        const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Between 1 and 50
        const skipVal = (pageNum - 1) * limitNum;

        // Build the aggregation pipeline
        const pipeline = [
            // First, filter only in-house visitors
            {
                $match: {
                    is_still_inhouse: true
                }
            },
            // Handle empty/null services_status by adding a placeholder for unassigned visitors
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
                                s_type: 'Pending',
                                provider_name: null,
                                provider_id: null
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
            // Unwind services_status array to process each service status separately
            {
                $unwind: {
                    path: '$services_status',
                    preserveNullAndEmptyArrays: false
                }
            },
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
            // Sort with Unassigned at the bottom, then by count descending
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
            },
            // Add pagination stages
            {
                $facet: {
                    metadata: [
                        { $count: "total_departments" }
                    ],
                    data: [
                        { $skip: skipVal },
                        { $limit: limitNum }
                    ]
                }
            }
        ];

        const result = await ServiceDelivery.aggregate(pipeline);
        
        // Extract data and metadata
        const departmentData = result[0]?.data || [];
        const totalDepartments = result[0]?.metadata[0]?.total_departments || 0;
        
        // Calculate total visitors across all departments (for the current page)
        const totalVisitorsOnPage = departmentData.reduce((sum, item) => sum + item.count, 0);
        
        // To get total visitors across ALL departments (without pagination), we need a separate query
        // This is more efficient than running another aggregation
        const totalVisitorsAllQuery = [
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
                                s_type: 'Pending',
                                provider_name: null,
                                provider_id: null
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
            // Group by department_name and get counts
            {
                $group: {
                    _id: '$services_status.department_name',
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: null,
                    total_visitors: { $sum: '$count' }
                }
            }
        ];
        
        const totalResult = await ServiceDelivery.aggregate(totalVisitorsAllQuery);
        const totalVisitorsAll = totalResult[0]?.total_visitors || 0;

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Current visitors retrieved successfully (all assigned and unassigned)',
            pagination: {
                current_page: pageNum,
                per_page: limitNum,
                total_departments: totalDepartments,
                total_visitors: totalVisitorsAll,
                total_pages: Math.ceil(totalDepartments / limitNum)
            },
            total_visitors_on_page: totalVisitorsOnPage,
            data: departmentData
        });

    } catch (error) {
        console.error("Error in get_visitors_by_provider_current:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving current visitors",
            error: error.message
        });
    }
};
