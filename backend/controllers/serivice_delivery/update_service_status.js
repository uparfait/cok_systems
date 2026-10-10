const { sendError, notFound } = require('../../utilities/visitors');

/**
 * PUT /servicedelivery/visitor/:id/status - disabled. Services change only
 * through POST /servicedelivery/visitor/service/status and the /visitors/:id
 * serve, complete and transfer actions, which keep the serving rules (one
 * server at a time, only the server completes).
 */
module.exports = function update_service_status(req, res) {
    return sendError(res, notFound('This endpoint is currently disabled'));
};
