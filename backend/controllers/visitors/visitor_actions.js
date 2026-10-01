const mongoose = require('mongoose');
const Visitor = require('../../models/visitor.js');
const {
    findOpenVisit, assignVisit, startService, completeService, transferService, sendError, badRequest, notFound, forbidden,
} = require('../../utilities/visitors');
const { isEmployee } = require('./permissions.js');
const { loadVisitorDetails } = require('./get_visitor.js');

async function openVisitFor(visitorId) {
    if (!mongoose.Types.ObjectId.isValid(visitorId)) throw badRequest('Invalid visitor id');
    const visitor = await Visitor.findById(visitorId).select('full_name').lean();
    if (!visitor) throw notFound('Visitor not found');
    const visit = await findOpenVisit(visitor._id);
    if (!visit) throw notFound('This visitor is not in house');
    return { visitor, visit };
}

const targetFrom = (body = {}) => ({
    department_id: body.department_id || body.new_department_id || null,
    department_name: body.department_name || body.new_department_name || '',
    provider_id: body.provider_id || null,
    provider_name: body.provider_name || '',
});

async function reply(req, res, message, visitorId) {
    const data = await loadVisitorDetails(req, visitorId);
    return res.status(200).json({ success: true, type: 'success', message, data });
}

/** POST /visitors/:id/send-to-department - every role except employee. */
async function send_to_department(req, res) {
    try {
        if (isEmployee(req)) throw forbidden('Employees transfer visitors instead of sending them');
        const { visitor, visit } = await openVisitFor(req.params.id);
        await assignVisit(visit, req.user, targetFrom(req.body), { visitorName: visitor.full_name });
        return reply(req, res, 'Visitor sent to the department', visitor._id);
    } catch (error) {
        return sendError(res, error, 'Failed to send the visitor to the department');
    }
}

/** POST /visitors/:id/serve - employees only; one server at a time. */
async function serve_visitor(req, res) {
    try {
        if (!isEmployee(req)) throw forbidden('Only employees can serve visitors');
        const { visitor, visit } = await openVisitFor(req.params.id);
        await startService(visit._id, req.user);
        return reply(req, res, 'You are now serving this visitor', visitor._id);
    } catch (error) {
        return sendError(res, error, 'Failed to start serving the visitor');
    }
}

/** POST /visitors/:id/complete - only the employee serving. */
async function complete_service(req, res) {
    try {
        if (!isEmployee(req)) throw forbidden('Only employees can complete a service');
        const { visitor, visit } = await openVisitFor(req.params.id);
        await completeService(visit._id, req.user, (req.body && req.body.notes) || null);
        return reply(req, res, 'Service completed', visitor._id);
    } catch (error) {
        return sendError(res, error, 'Failed to complete the service');
    }
}

/** POST /visitors/:id/transfer - employees only. */
async function transfer_visitor(req, res) {
    try {
        if (!isEmployee(req)) throw forbidden('Only employees can transfer visitors');
        const { visitor, visit } = await openVisitFor(req.params.id);
        await transferService(visit._id, req.user, targetFrom(req.body), {
            notes: (req.body && req.body.notes) || null,
            visitorName: visitor.full_name,
        });
        return reply(req, res, 'Visitor transferred', visitor._id);
    } catch (error) {
        return sendError(res, error, 'Failed to transfer the visitor');
    }
}

module.exports = {
    send_to_department,
    serve_visitor,
    complete_service,
    transfer_visitor,
};
