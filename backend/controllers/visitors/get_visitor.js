const mongoose = require('mongoose');
const Visitor = require('../../models/visitor.js');
const ServiceDelivery = require('../../models/service_delivery.js');
const {
    readVisitorInput, lookupVisitor, visitorView, visitView, sendError, badRequest, notFound,
} = require('../../utilities/visitors');
const { permissionsFor } = require('./permissions.js');

/** Visitor with its open visit, last visit, totals and what the caller may do. */
async function loadVisitorDetails(req, visitorId) {
    if (!mongoose.Types.ObjectId.isValid(visitorId)) throw badRequest('Invalid visitor id');
    const visitor = await Visitor.findById(visitorId).lean();
    if (!visitor) throw notFound('Visitor not found');

    const [openVisit, lastVisit, visitsTotal] = await Promise.all([
        ServiceDelivery.findOne({ visitor: visitor._id, is_still_inhouse: true }).populate('visitor').lean(),
        ServiceDelivery.findOne({ visitor: visitor._id }).sort({ entry_date: -1 }).populate('visitor').lean(),
        ServiceDelivery.countDocuments({ visitor: visitor._id }),
    ]);

    return {
        visitor: visitorView(visitor),
        current_visit: openVisit ? visitView(openVisit) : null,
        last_visit: lastVisit ? visitView(lastVisit) : null,
        visits_total: visitsTotal,
        permissions: permissionsFor(req, { openVisit, hasVisit: visitsTotal > 0 }),
    };
}

/** GET /visitors/:id */
async function get_visitor(req, res) {
    try {
        const data = await loadVisitorDetails(req, req.params.id);
        return res.status(200).json({ success: true, type: 'success', data });
    } catch (error) {
        return sendError(res, error, 'Failed to load the visitor');
    }
}

/**
 * GET /visitors/lookup?identification=&telephone=&email=&exclude=
 * Who owns these values (to pre-fill a form) and whether they belong to
 * different people.
 */
async function lookup_visitor(req, res) {
    try {
        const q = req.query || {};
        const input = readVisitorInput({
            identification: { number: q.identification || q.id_number },
            telephone: q.telephone,
            email: q.email,
        });
        const exclude = q.exclude && mongoose.Types.ObjectId.isValid(q.exclude) ? q.exclude : null;
        const result = await lookupVisitor(input, exclude);
        return res.status(200).json({
            success: true,
            type: 'success',
            visitor: result.visitor ? visitorView(result.visitor) : null,
            matches: result.matches.map((m) => ({ field: m.field, visitor: visitorView(m.visitor) })),
            conflict: result.conflict,
        });
    } catch (error) {
        return sendError(res, error, 'Failed to look up the visitor');
    }
}

module.exports = {
    loadVisitorDetails,
    get_visitor,
    lookup_visitor,
};
