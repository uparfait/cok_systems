const ServiceDelivery = require('../../models/service_delivery.js');
const {
    visitFromRef, startService, completeService, visitView, sendError, badRequest, notFound, forbidden,
} = require('../../utilities/visitors');

/**
 * POST /servicedelivery/visitor/service/status
 * Body: { visitor_id (visit id or visitor id), status: 'Inprogress' | 'Completed', notes? }
 * Inprogress = serve (one server at a time); Completed = only the one serving.
 * Serving is an employee action.
 */
module.exports = async function toggle_service_status(req, res) {
    try {
        const { visitor_id = null, status = null, notes = null } = req.body || {};
        if (!visitor_id || !status) throw badRequest('Visitor ID and Status are required');
        if (!['Inprogress', 'Completed'].includes(status)) throw badRequest("Status must be 'Inprogress' or 'Completed'");
        if (String((req.navigation && req.navigation.role_slug) || '') !== 'employee') {
            throw forbidden('Only employees can serve visitors');
        }

        const visit = await visitFromRef(visitor_id);
        if (!visit || !visit.is_still_inhouse) throw notFound('Active visitor not found');

        if (status === 'Inprogress') await startService(visit._id, req.user);
        else await completeService(visit._id, req.user, notes);

        const fresh = await ServiceDelivery.findById(visit._id).populate('visitor').lean();
        return res.status(200).json({
            success: true,
            type: 'success',
            message: `Service status successfully changed to ${status}`,
            data: visitView(fresh),
        });
    } catch (error) {
        return sendError(res, error, 'Failed to update service status');
    }
};
