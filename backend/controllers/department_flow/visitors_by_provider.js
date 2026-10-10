const { sendError } = require('../../utilities/visitors');
const {
    visitScopeFor, assignedTo, entryDateFilter, paging, findVisitPage, visitRows, noDepartments,
} = require('./visitors_by_status');

/**
 * GET /department-manager/visitors/provider/:providerId
 * Visits a provider was assigned to, or served, in one of the managed
 * departments (their entries of other departments are not shown).
 * Query: page, limit (<= 50), from, to, dateFilter.
 */
const getVisitorsByProvider = async (req, res, next) => {
    try {
        const providerId = String(req.params.providerId || '');
        const q = req.query || {};

        const departmentIds = await visitScopeFor(req);
        if (departmentIds.length === 0) return noDepartments(res);

        const byProvider = { $elemMatch: { provider_id: providerId, department_id: { $in: departmentIds } } };
        const { page, limit, skip } = paging(q);
        const filter = {
            ...assignedTo(departmentIds),
            $or: [{ services_status: byProvider }, { departments_assigned: byProvider }],
            ...entryDateFilter(q),
        };
        const { rows, total } = await findVisitPage(filter, { skip, limit });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Visitors by provider retrieved successfully',
            total,
            page,
            limit,
            data: visitRows(rows, { scope: departmentIds, providerId })
        });

    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving visitors by provider');
    }
};

module.exports = {
    getVisitorsByProvider
};
