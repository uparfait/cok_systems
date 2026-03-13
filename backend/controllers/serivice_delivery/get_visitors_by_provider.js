const ServiceDelivery = require('../../models/service_delivery.js');

/**
 * Get visitors assigned to a specific provider (employee)
 * Filter by provider_id in services_status array
 * Returns the actual visitor records, not aggregated counts
 */
module.exports = async function get_visitors_by_provider(req, res, next) {
    try {
        let { 
            provider_id = null,
            is_still_inhouse = null,
            limit = 10, 
            page = 1 
        } = req.query || {};

        if (!provider_id) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'provider_id is required'
            });
        }

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Build filter object
        let filter = {};

        // Filter by is_still_inhouse if provided
        if (is_still_inhouse !== null) {
            if (is_still_inhouse === 'true' || is_still_inhouse === true) {
                filter.is_still_inhouse = true;
            } else if (is_still_inhouse === 'false' || is_still_inhouse === false) {
                filter.is_still_inhouse = false;
            }
        }

        // Build the aggregation pipeline
        let pipeline = [];

        // Match by is_still_inhouse if provided
        if (is_still_inhouse !== null) {
            if (is_still_inhouse === 'true' || is_still_inhouse === true) {
                pipeline.push({ $match: { is_still_inhouse: true } });
            } else if (is_still_inhouse === 'false' || is_still_inhouse === false) {
                pipeline.push({ $match: { is_still_inhouse: false } });
            }
        }

        // Unwind services_status to filter by provider
        pipeline.push({ $unwind: '$services_status' });
        
        // Filter by provider_id
        pipeline.push({ 
            $match: { 
                'services_status.provider_id': provider_id 
            }
        });

        // Add pagination
        pipeline.push({ $skip: skip_val });
        pipeline.push({ $limit: limit_val });

        // Execute aggregation
        const visitors = await ServiceDelivery.aggregate(pipeline);

        // Get total count for pagination
        let countPipeline = [];
        if (is_still_inhouse !== null) {
            if (is_still_inhouse === 'true' || is_still_inhouse === true) {
                countPipeline.push({ $match: { is_still_inhouse: true } });
            } else if (is_still_inhouse === 'false' || is_still_inhouse === false) {
                countPipeline.push({ $match: { is_still_inhouse: false } });
            }
        }
        
        countPipeline.push({ $unwind: '$services_status' });
        countPipeline.push({ 
            $match: { 
                'services_status.provider_id': provider_id 
            }
        });
        countPipeline.push({ $count: 'total' });
        
        const countResult = await ServiceDelivery.aggregate(countPipeline);
        const total_count = countResult.length > 0 ? countResult[0].total : 0;

        // Format the response
        const formatted_visitors = visitors.map(visitor => {
            // Get the provider-specific status
            let current_status = null;
            let current_department = null;
            
            // Get department info from departments_assigned
            if (visitor.departments_assigned && visitor.departments_assigned.length > 0) {
                const dept = visitor.departments_assigned.find(d => d.provider_id === provider_id);
                if (dept) {
                    current_department = {
                        department_id: dept.department_id,
                        department_name: dept.department_name,
                        assigned_time: dept.assigned_time,
                        reached_in: dept.reached_in
                    };
                }
            }

            // Get overall service status
            if (visitor.services_status) {
                current_status = {
                    status: visitor.services_status.s_type,
                    provider_name: visitor.services_status.provider_name,
                    department_name: visitor.services_status.department_name
                };
            }

            return {
                _id: visitor._id,
                full_name: visitor.full_name,
                telephone: visitor.telephone,
                email: visitor.email,
                badge_number: visitor.badge_number,
                entry_date: visitor.entry_date,
                exist_date: visitor.exist_date,
                is_still_inhouse: visitor.is_still_inhouse,
                gender: visitor.gender,
                current_department: current_department,
                current_status: current_status,
                has_vehicle: visitor.vehicle_storage?.has_vehicle || false,
                vehicle_plate: visitor.vehicle_storage?.vehicle_details?.plate_number || null
            };
        });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Visitors retrieved successfully',
            provider_id: provider_id,
            total: total_count,
            page: parseInt(page),
            data: formatted_visitors
        });

    } catch (error) {
        console.error("Error in get_visitors_by_provider:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving visitors by provider",
            error: error.message
        });
    }
};
