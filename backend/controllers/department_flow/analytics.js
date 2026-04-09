

const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');
const { getDepartmentIdsForHead } = require('./visitors_by_status');

/**
 * GET /department-manager/analytics/response-time
 * Get average response time per provider for department
 */
const getResponseTimeAnalytics = async (req, res, next) => {
    try {
        // Get department IDs for head of department
        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        // Get departments with response times > 0
        const departments = await Department.find({
            _id: { $in: departmentIds },
            department_response_time_in_minutes: { $gt: 0 }
        });

        // Calculate average response time per provider
        const analytics = [];

        for (const dept of departments) {
            // Get all services for this department
            const services = await ServiceDelivery.find({
                'services_status.department_id': dept._id.toString(),
                'durations.services_durations': { $exists: true, $ne: [] }
            });

            const providerStats = {};

            services.forEach(service => {
                const deptServices = service.services_status?.filter(s =>
                    s.department_id === dept._id.toString()
                ) || [];

                deptServices.forEach(serviceStatus => {
                    const providerId = serviceStatus.provider_id;
                    const providerName = serviceStatus.provider_name;

                    if (providerId && providerName) {
                        if (!providerStats[providerId]) {
                            providerStats[providerId] = {
                                provider_id: providerId,
                                provider_name: providerName,
                                total_services: 0,
                                total_response_time: 0,
                                average_response_time: 0
                            };
                        }

                        // Find service duration for this provider
                        const duration = service.durations?.services_durations?.find(d =>
                            d.provider_id === providerId
                        );

                        if (duration && duration.started_at) {
                            const serviceStart = new Date(duration.started_at);
                            const entryTime = new Date(service.entry_date || service.createdAt);
                            const responseTimeMinutes = Math.max(0,
                                (serviceStart.getTime() - entryTime.getTime()) / (1000 * 60)
                            );

                            providerStats[providerId].total_services++;
                            providerStats[providerId].total_response_time += responseTimeMinutes;
                        }
                    }
                });
            });

            // Calculate averages
            Object.values(providerStats).forEach((stat) => {
                if (stat.total_services > 0) {
                    stat.average_response_time = stat.total_response_time / stat.total_services;
                }
            });

            analytics.push({
                department_id: dept._id,
                department_name: dept.department_name,
                expected_response_time: dept.department_response_time_in_minutes,
                provider_stats: Object.values(providerStats)
            });
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Response time analytics retrieved successfully',
            data: analytics
        });

    } catch (error) {
        console.error('Error in getResponseTimeAnalytics:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving analytics',
            error: error.message
        });
    }
};

module.exports = {
    getResponseTimeAnalytics
};