
const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');

/**
 * Get visitors filtered by department along with current status
 */
module.exports = async function get_visitors_by_department(req, res, next) {
    try {
        let { 
            department_id = null, 
            department_name = null,
            is_still_inhouse = null,
            limit = 10, 
            page = 1 
        } = req.query || {};

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Build filter object - we need to filter by departments_assigned array
        let filter = {};

        // Filter by is_still_inhouse if provided
        if (is_still_inhouse !== null) {
            if (is_still_inhouse === 'true' || is_still_inhouse === true) {
                filter.is_still_inhouse = true;
            } else if (is_still_inhouse === 'false' || is_still_inhouse === false) {
                filter.is_still_inhouse = false;
            }
        }

        // If department_id or department_name is provided, filter by it
        let department_filter = null;
        if (department_id) {
            department_filter = department_id;
        } else if (department_name) {
            const department = await Department.findOne({ 
                $or: [
                    { department_name: department_name },
                    { department_name: { $regex: department_name, $options: 'i' } }
                ]
            });
            
            if (department) {
                department_filter = department.department_id;
            } else {
                return res.status(404).json({
                    success: false,
                    type: 'warning',
                    message: `Department with name "${department_name}" not found`
                });
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

        // If department filter is provided, unwind and match
        if (department_filter) {
            pipeline.push({ $unwind: '$departments_assigned' });
            pipeline.push({ 
                $match: { 
                    'departments_assigned.department_id': department_filter 
                }
            });
        }

        // Add pagination
        pipeline.push({ $skip: skip_val });
        pipeline.push({ $limit: limit_val });

        // Execute aggregation
        const visitors = await ServiceDelivery.aggregate(pipeline);

        // Get total count for pagination (without pagination stages)
        let countPipeline = [];
        if (is_still_inhouse !== null) {
            if (is_still_inhouse === 'true' || is_still_inhouse === true) {
                countPipeline.push({ $match: { is_still_inhouse: true } });
            } else if (is_still_inhouse === 'false' || is_still_inhouse === false) {
                countPipeline.push({ $match: { is_still_inhouse: false } });
            }
        }
        
        if (department_filter) {
            countPipeline.push({ $unwind: '$departments_assigned' });
            countPipeline.push({ 
                $match: { 
                    'departments_assigned.department_id': department_filter 
                }
            });
        }
        
        countPipeline.push({ $count: 'total' });
        
        const countResult = await ServiceDelivery.aggregate(countPipeline);
        const total_count = countResult.length > 0 ? countResult[0].total : 0;

        // Get department info if filtering by department
        let department_info = null;
        if (department_filter) {
            department_info = await Department.findOne({ department_id: department_filter })
                .select('department_name department_id');
        }

        // Format the response to include current status
        const formatted_visitors = visitors.map(visitor => {
            // Get the department-specific status if assigned
            let current_status = null;
            let current_department = null;
            
            if (visitor.departments_assigned && visitor.departments_assigned.length > 0) {
                const dept = visitor.departments_assigned.find(d => 
                    department_filter ? d.department_id === department_filter : true
                );
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
            if (visitor.services_status && visitor.services_status.length > 0) {
                const statusEntry = visitor.services_status.find(s => 
                    department_filter ? s.department_id === department_filter : true
                );
                if (statusEntry) {
                    current_status = {
                        status: statusEntry.s_type,
                        provider_name: statusEntry.provider_name,
                        department_name: statusEntry.department_name
                    };
                }
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
            department: department_info,
            total: total_count,
            page: parseInt(page),
            data: formatted_visitors
        });

    } catch (error) {
        console.error("Error in get_visitors_by_department:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving visitors by department",
            error: error.message
        });
    }
};
