const ServiceDelivery = require('../../models/service_delivery.js');
const Visitor = require('../../models/visitor.js');
const {
    departmentScopeFor, visitView, escapeRegex, normalizeIdNumber, sendError,
} = require('../../utilities/visitors');

/**
 * Department lists of visits: the employee and head of department queues.
 * What a caller sees comes only from departmentScopeFor: an employee sees
 * their department and unit, a head of department also every department
 * they lead and the units of those departments. A caller without any
 * department gets an empty list. The by-provider queue, the service
 * tracking list and the queue summary reuse these helpers, so their
 * numbers always agree.
 */

// A service entry in one of these states no longer waits for its department
const CLOSED_STATES = ['Completed', 'Transfered'];
const VISITOR_FIELDS = 'identification full_name telephone email gender Is_In_House N_visits createdAt updatedAt';
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const callerScope = (req) => departmentScopeFor(req.user, req.navigation && req.navigation.role_slug);

/** Visits with an assignment (current or earlier) to one of these departments. */
const assignedTo = (ids) => ({ departments_assigned: { $elemMatch: { department_id: { $in: ids } } } });

/** Visits still waiting for, or being served by, one of these departments. */
const pendingFor = (ids) => ({ services_status: { $elemMatch: { department_id: { $in: ids }, s_type: { $nin: CLOSED_STATES } } } });

/** Visits one of these departments is serving right now. */
const servingFor = (ids) => ({ services_status: { $elemMatch: { department_id: { $in: ids }, s_type: 'Inprogress' } } });

/** in_house=true (default) | false | anything else for both. Older screens send is_still_inhouse. */
function presenceFilter(q = {}) {
    const raw = q.in_house !== undefined ? q.in_house : q.is_still_inhouse;
    const value = raw === undefined ? 'true' : String(raw).toLowerCase();
    if (value === 'true') return { is_still_inhouse: true };
    if (value === 'false') return { is_still_inhouse: false };
    return {};
}

function paging(q, maxLimit) {
    const limit = Math.min(maxLimit, Math.max(1, parseInt(q.limit, 10) || 20));
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    return { page, limit, skip: (page - 1) * limit };
}

/** Ids of the visitors whose name, ID number, telephone or email contains the text. */
function visitorIdsMatching(text) {
    const term = String(text).trim();
    const contains = (value) => ({ $regex: escapeRegex(value), $options: 'i' });
    const or = [{ full_name: contains(term) }, { email: contains(term) }];
    const idNumber = normalizeIdNumber(term);
    if (idNumber) or.push({ 'identification.number': contains(idNumber) });
    // Stored phones are 07XXXXXXXX: compare digits without the 250 / 0 prefix
    const digits = term.replace(/\D/g, '');
    const local = digits.length >= 3 ? digits.replace(/^250/, '').replace(/^0/, '') : '';
    if (local) or.push({ telephone: contains(local) });
    return Visitor.distinct('_id', { $or: or });
}

/** How long the visitor has been inside (open visits) or stayed (closed visits). 8 hours is the stay limit. */
function stayFields(visit, now) {
    if (visit.is_still_inhouse && visit.entry_date) {
        const minutes = Math.max(0, Math.floor((now - new Date(visit.entry_date).getTime()) / 60000));
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        const hoursInside = hours + rest / 60;
        return {
            current_duration: hours > 0 ? `${hours}h ${rest}m` : `${rest} mins`,
            current_duration_hours: hoursInside,
            is_near_limit: hoursInside >= 7,
            is_over_limit: hoursInside >= 8,
        };
    }
    const storage = visit.vehicle_storage || {};
    const parked = storage.has_vehicle && storage.vehicle_details ? storage.vehicle_details.duration : '';
    const stored = (visit.durations && visit.durations.entry_and_leave_duration) || parked || '';
    if (stored) return { current_duration: stored, current_duration_hours: (parseFloat(stored) / 60) || 0 };
    return { current_duration: 'N/A', current_duration_hours: 0 };
}

/** The caller-scope service entry of a visit: the newest one still open, else the newest one. */
function scopeServiceOf(visit, scope) {
    const entries = (visit.services_status || []).filter((s) => scope.has(String(s.department_id)));
    return entries.find((s) => !CLOSED_STATES.includes(s.s_type)) || entries[0] || null;
}

/**
 * Send one page of the caller's department visits, newest arrival first.
 * Each row is a visit view plus the stay fields and scope_service.
 * Query: page, limit, in_house, q (name, ID number, telephone or email).
 * @param {function} options.match       scope ids -> condition on the visits
 * @param {string} [options.department] requested department: narrows the scope to it, never widens it
 * @param {boolean} [options.inHouseOnly] ignore in_house and list open visits only
 */
async function sendScopedVisits(req, res, { match, message, errorMessage, maxLimit = 50, inHouseOnly = false, department = null }) {
    const q = req.query || {};
    const { page, limit, skip } = paging(q, maxLimit);
    const reply = (total, data) => res.status(200).json({ success: true, type: 'success', message, total, page, limit, data });
    try {
        let scope = await callerScope(req);
        if (department && OBJECT_ID.test(String(department))) scope = scope.filter((id) => id === String(department));
        if (scope.length === 0) return reply(0, []);

        const filter = { ...(inHouseOnly ? { is_still_inhouse: true } : presenceFilter(q)), ...match(scope) };
        const search = q.q || q.search || q.query;
        if (typeof search === 'string' && search.trim()) {
            const ids = await visitorIdsMatching(search);
            if (ids.length === 0) return reply(0, []);
            filter.visitor = { $in: ids };
        }

        const [rows, total] = await Promise.all([
            ServiceDelivery.find(filter).sort({ entry_date: -1 }).skip(skip).limit(limit).populate('visitor', VISITOR_FIELDS).lean(),
            ServiceDelivery.countDocuments(filter),
        ]);
        const now = Date.now();
        const inScope = new Set(scope);
        return reply(total, rows.map((row) => ({ ...visitView(row), ...stayFields(row, now), scope_service: scopeServiceOf(row, inScope) })));
    } catch (error) {
        return sendError(res, error, errorMessage);
    }
}

/**
 * GET /servicedelivery/visitor/by-department-current/:id and GET /visitor/by-department?department_id=
 * Visits with an assignment to the caller's departments (in house by default).
 * A department id narrows the list to that department when it is in the
 * caller's scope (a department outside the scope gives an empty list).
 * Query: page, limit (<= 50), in_house (or is_still_inhouse) true|false|all, q.
 */
function get_visitors_by_department_current(req, res) {
    return sendScopedVisits(req, res, {
        match: assignedTo,
        message: 'Visitors results',
        errorMessage: 'Something went wrong while retrieving visitors',
        department: (req.params && req.params.id) || (req.query && req.query.department_id) || null,
    });
}

module.exports = get_visitors_by_department_current;
Object.assign(module.exports, {
    CLOSED_STATES,
    callerScope,
    assignedTo,
    pendingFor,
    servingFor,
    presenceFilter,
    sendScopedVisits,
});
