const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');
const User = require('../../models/user.js');
const { departmentScopeFor, visitView, sendError } = require('../../utilities/visitors');

const HOD_ROLE_KEYWORDS = ['department manager', 'department head', 'head of department', 'director'];

// Service entry states (services_status[].s_type). A department is finished
// with a visitor once its own entry is Completed or Transfered.
const NOT_STARTED = ['Not started'];
const IN_PROGRESS = ['Inprogress'];
const TRANSFERRED = ['Transfered', 'Transferred'];
const FINISHED = ['Completed', 'Transfered', 'Transferred'];

const VALID_STATUSES = ['pending', 'active', 'transferred', 'completed', 'not_served'];

// The entry a row is shown with, per status
const STATUS_STATES = {
    pending: NOT_STARTED,
    active: IN_PROGRESS,
    transferred: TRANSFERRED,
    completed: FINISHED,
};

const VISITOR_FIELDS = 'identification full_name telephone email gender Is_In_House N_visits createdAt updatedAt';

/**
 * Helper function to get department IDs for head of department
 * Supports both the current schema (is_unit + parent_department) and the
 * legacy document format (sub_department_mng), and users leading multiple departments.
 * Users with an HOD-type role also manage the department their own account belongs to,
 * even when no department document points at them as leader (matches frontend gating).
 */
const getDepartmentIdsForHead = async (userId) => {
    const ledDepartments = await Department.find({
        $or: [{ department_leader: userId }, { leader: userId }]
    });

    const self = await User.findById(userId).select('department roles.role_name');
    const roleName = (self?.roles?.role_name || '').toLowerCase();
    if (self?.department && HOD_ROLE_KEYWORDS.some(keyword => roleName.includes(keyword))) {
        const ownDepartment = await Department.findById(self.department);
        if (ownDepartment) ledDepartments.push(ownDepartment);
    }

    if (ledDepartments.length === 0) {
        return [];
    }

    const ids = new Set();

    for (const department of ledDepartments) {
        ids.add(department._id.toString());

        const isSubDepartment = department.is_unit === true ||
            department.sub_department_mng?.is_sub_department === true;

        if (!isSubDepartment) {
            // Main department - include its sub-departments (new + legacy format)
            const subDepartments = await Department.find({
                $or: [
                    { parent_department: department._id },
                    { 'sub_department_mng.parent_department_id': department._id.toString() }
                ]
            });
            subDepartments.forEach(sub => ids.add(sub._id.toString()));
        }
    }

    return Array.from(ids);
};

/**
 * Helper function to build date filter
 */
const buildDateFilter = (dateFilter, dateField = 'entry_date') => {
    if (!dateFilter) return {};

    const now = new Date();
    let startDate, endDate;

    switch (dateFilter) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
        case 'yesterday':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'this_week':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
        case 'last_week':
            const lastWeekStart = new Date(now);
            lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
            const lastWeekEnd = new Date(now);
            lastWeekEnd.setDate(now.getDate() - now.getDay());
            startDate = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate());
            endDate = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate());
            break;
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            return {};
    }

    return {
        [dateField]: {
            $gte: startDate,
            $lt: endDate
        }
    };
};

/**
 * Departments whose visits the head of department API shows: the shared
 * visitor scope (own department and unit; for heads of department every
 * department they lead and its units) plus the departments this API has
 * always resolved (getDepartmentIdsForHead), so every department listed by
 * GET /department-manager/departments is accepted by the visit endpoints.
 */
const visitScopeFor = async (req) => {
    const user = (req && req.user) || {};
    const userId = user.userId || user.id || user._id;
    const [shared, led] = await Promise.all([
        departmentScopeFor(user, req && req.navigation && req.navigation.role_slug),
        userId ? getDepartmentIdsForHead(userId) : [],
    ]);
    return [...new Set([...shared, ...led].map(String))];
};

/** Visits sent (now or earlier) to one of these departments. */
const assignedTo = (ids) => ({ departments_assigned: { $elemMatch: { department_id: { $in: ids } } } });

/** A service entry of one of these departments in one of these states. */
const entryOf = (ids, states) => ({ $elemMatch: { department_id: { $in: ids }, s_type: { $in: states } } });

/**
 * Conditions of a status, decided only on the service entries of the given
 * departments (an entry of another department never counts):
 *  - pending: in house, waiting for the department;
 *  - active: in house, being served by the department right now;
 *  - transferred: in house, the department transferred the visitor;
 *  - completed: the department is finished (Completed or Transfered),
 *    optionally only in house / only gone (inhouse=true|false);
 *  - not_served: gone without the department ever finishing.
 * @returns {object|null} null for an unknown status
 */
function statusFilter(status, ids, { inhouse } = {}) {
    switch (status) {
        case 'pending':
            return { is_still_inhouse: true, services_status: entryOf(ids, NOT_STARTED) };
        case 'active':
            return { is_still_inhouse: true, is_being_served: true, services_status: entryOf(ids, IN_PROGRESS) };
        case 'transferred':
            return { is_still_inhouse: true, services_status: entryOf(ids, TRANSFERRED) };
        case 'completed': {
            const filter = { services_status: entryOf(ids, FINISHED) };
            if (inhouse !== undefined) filter.is_still_inhouse = String(inhouse) === 'true';
            return filter;
        }
        case 'not_served':
            return { is_still_inhouse: false, $nor: [{ services_status: entryOf(ids, FINISHED) }] };
        default:
            return null;
    }
}

/** entry_date range: explicit from/to (whole local days) first, else a dateFilter preset. */
function entryDateFilter({ from, to, dateFilter } = {}) {
    if (from || to) {
        const range = {};
        if (from) { const start = new Date(from); if (!isNaN(start.getTime())) { start.setHours(0, 0, 0, 0); range.$gte = start; } }
        if (to) { const end = new Date(to); if (!isNaN(end.getTime())) { end.setHours(23, 59, 59, 999); range.$lte = end; } }
        return Object.keys(range).length > 0 ? { entry_date: range } : {};
    }
    return buildDateFilter(dateFilter);
}

function paging(query = {}, maxLimit = 50) {
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || 20));
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    return { page, limit, skip: (page - 1) * limit };
}

/** One page of visits (newest arrival first) with their visitor, and the total. */
async function findVisitPage(filter, { skip, limit }) {
    const [rows, total] = await Promise.all([
        ServiceDelivery.find(filter)
            .sort({ entry_date: -1 })
            .skip(skip)
            .limit(limit)
            .populate('visitor', VISITOR_FIELDS)
            .lean(),
        ServiceDelivery.countDocuments(filter),
    ]);
    return { rows, total };
}

/**
 * The service entry of the scope a row is shown with: the newest one in one
 * of the states (and of the provider, when given), else the newest one.
 */
function scopeServiceOf(visit, scope, { states = null, providerId = null } = {}) {
    const entries = (visit.services_status || []).filter((s) => scope.has(String(s.department_id))
        && (!providerId || String(s.provider_id) === providerId));
    return (states && entries.find((s) => states.includes(s.s_type))) || entries[0] || null;
}

/** How long an in-house visitor has been inside. */
function durationSince(entryDate, now) {
    const durationMs = now - new Date(entryDate).getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
        current_duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`,
        current_duration_hours: hours + minutes / 60,
    };
}

/**
 * Visit views (flat person fields from the referenced visitor, legacy
 * records from their own fields) plus scope_service; active rows also get
 * the time spent inside.
 */
function visitRows(rows, { scope, status = null, providerId = null }) {
    const inScope = new Set((scope || []).map(String));
    const states = STATUS_STATES[status] || null;
    const now = Date.now();
    return rows.map((row) => {
        const view = { ...visitView(row), scope_service: scopeServiceOf(row, inScope, { states, providerId }) };
        if (status === 'active' && row.is_still_inhouse && row.entry_date) Object.assign(view, durationSince(row.entry_date, now));
        return view;
    });
}

const noDepartments = (res) => res.status(403).json({
    success: false,
    type: 'error',
    message: 'No departments found for this user'
});

/**
 * GET /department-manager/visitors/status/:status
 * Visits of the managed departments by status (pending, active, transferred,
 * completed, not_served). Query: page, limit (<= 50), from, to, dateFilter,
 * inhouse (completed only).
 */
const getVisitorsByStatus = async (req, res, next) => {
    try {
        const { status } = req.params;
        const q = req.query || {};

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'Invalid status. Must be: pending, active, transferred, completed, not_served'
            });
        }

        const departmentIds = await visitScopeFor(req);
        if (departmentIds.length === 0) return noDepartments(res);

        const { page, limit, skip } = paging(q);
        const filter = {
            ...assignedTo(departmentIds),
            ...statusFilter(status, departmentIds, { inhouse: q.inhouse }),
            ...entryDateFilter(q),
        };
        const { rows, total } = await findVisitPage(filter, { skip, limit });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: `${status.charAt(0).toUpperCase() + status.slice(1)} visitors retrieved successfully`,
            total,
            page,
            limit,
            data: visitRows(rows, { scope: departmentIds, status })
        });

    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving visitors');
    }
};

module.exports = {
    getVisitorsByStatus,
    getDepartmentIdsForHead,
    buildDateFilter,
    visitScopeFor,
    assignedTo,
    statusFilter,
    entryDateFilter,
    paging,
    findVisitPage,
    visitRows,
    noDepartments,
    TRANSFERRED,
    FINISHED,
    VALID_STATUSES,
};
