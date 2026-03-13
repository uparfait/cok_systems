const ServiceDelivery = require('../../models/service_delivery.js');

/**
 * Get total visitors count and details by provider who are currently in house 
 * and have status not completed
 * Filter: is_still_inhouse = true AND services_status.s_type != 'Completed'
 * Return: count and visitors array by provider_id
 * Param: provider_id from URL params (optional)
 */
module.exports = async function get_visitors_by_provider_current(req, res, next) {
    try {
        const provider_id = req.params.id;

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
            // If provider_id is provided, filter by it
            ...(provider_id ? [{
                $match: {
                    'services_status.provider_id': provider_id
                }
            }] : []),
            // Remove sensitive or unnecessary fields before grouping
            {
                $project: {
                    'password': 0, // In case it accidentally exists in the document
                    'auth': 0,     // In case it accidentally exists in the document
                    '__v': 0
                }
            },
            // Group by provider_id
            {
                $group: {
                    _id: '$services_status.provider_id',
                    count: { $sum: 1 },
                    provider_name: { $first: '$services_status.provider_name' },
                    // Push the entire matched document into a 'visitors' array
                    // Using $$ROOT gives us the whole document
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
                    provider_id: '$_id',
                    provider_name: 1,
                    count: 1,
                    // Re-format the visitors array to clean up the unwound structure if needed, 
                    // but usually returning the root document is what you want.
                    visitors: 1 
                }
            }
        ];

        const providerData = await ServiceDelivery.aggregate(pipeline);
        
        // Calculate total visitors across all matched providers
        const total = providerData.reduce((sum, item) => sum + item.count, 0);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Current visitors by provider retrieved successfully',
            total_visitors: total,
            data: providerData
        });

    } catch (error) {
        console.error("Error in get_visitors_by_provider_current:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving current visitors by provider",
            error: error.message
        });
    }
};