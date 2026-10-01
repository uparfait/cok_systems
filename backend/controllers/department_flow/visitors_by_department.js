const { sendError } = require('../../utilities/visitors');
const {
    visitScopeFor, assignedTo, statusFilter, entryDateFilter, paging, findVisitPage, visitRows, noDepartments,
} = require('./visitors_by_status');

/**
 * GET /department-manager/visitors/department/:departmentId
 * Visits sent to one managed department or unit. The optional status
 * (pending, active, transferred, completed, not_served) is decided on that
 * department's own service entries. Query: page, limit (<= 50), status,
 * from, to, dateFilter.
 */
const getVisitorsByDepartment = async (req, res, next) => {
    try {
        const departmentId = String(req.params.departmentId || '');
        const q = req.query || {};

        const allowedDepartmentIds = await visitScopeFor(req);
        if (allowedDepartmentIds.length === 0) return noDepartments(res);

        if (!allowedDepartmentIds.includes(departmentId)) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'Access denied to this department'
            });
        }

        const ids = [departmentId];
        const status = typeof q.status === 'string' ? q.status : null;
        const { page, limit, skip } = paging(q);
        const filter = {
            ...assignedTo(ids),
            ...(statusFilter(status, ids) || {}),
            ...entryDateFilter(q),
        };
        const { rows, total } = await findVisitPage(filter, { skip, limit });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Visitors by department retrieved successfully',
            total,
            page,
            limit,
            data: visitRows(rows, { scope: ids, status })
        });

    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving visitors by department');
    }
};

module.exports = {
    getVisitorsByDepartment
};
