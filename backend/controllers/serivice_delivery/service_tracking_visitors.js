const { sendScopedVisits, assignedTo } = require('./get_visitors_by_department_current.js');

/**
 * GET /servicedelivery/service-tracking/visitors
 * In-house visits assigned to the caller's department scope, newest arrival first.
 * Query: page, limit (<= 20), q (name, ID number, telephone, email).
 */
module.exports = function service_tracking_visitors(req, res) {
    return sendScopedVisits(req, res, {
        match: assignedTo,
        inHouseOnly: true,
        maxLimit: 20,
        message: 'Service tracking visitors results',
        errorMessage: 'Something went wrong while retrieving service tracking visitors',
    });
};
