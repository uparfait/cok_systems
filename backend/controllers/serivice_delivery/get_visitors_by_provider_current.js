const { sendScopedVisits, pendingFor } = require('./get_visitors_by_department_current.js');

/**
 * GET /servicedelivery/visitor/by-provider-current/:id and GET /visitor/by-provider
 * The caller's department queue: visits assigned to the caller's department
 * scope that the scope has not completed or transferred yet (waiting or
 * being served). Every screen sends the caller's own id in the path; the
 * queue always comes from the caller's department scope.
 * Query: page, limit (<= 50), in_house (default true), q (name, ID number, telephone, email).
 */
module.exports = function get_visitors_by_provider_current(req, res) {
    return sendScopedVisits(req, res, {
        match: pendingFor,
        message: 'Visitors results',
        errorMessage: 'Something went wrong while retrieving visitors',
    });
};
