const ServiceDelivery = require('../../models/service_delivery.js');
const Visitor = require('../../models/visitor.js');
const {
    escapeRegex, normalizeIdNumber, departmentScopeFor, userIdOf, visitView, sendError, forbidden,
} = require('../../utilities/visitors');
const { roleSlugOf } = require('../visitors/permissions.js');

const SCOPED_ROLES = ['employee', 'department-manager'];

const textOf = (value) => String((Array.isArray(value) ? value[0] : value) || '').trim();
const contains = (text) => ({ $regex: escapeRegex(text), $options: 'i' });

/**
 * Visitors whose name, ID number or email contains the text, or whose
 * telephone contains its digits (stored phones are in the 07XXXXXXXX form).
 */
function matchingVisitorIds(text) {
    const or = [{ full_name: contains(text) }, { email: contains(text) }];
    const idNumber = normalizeIdNumber(text);
    if (idNumber) or.push({ 'identification.number': contains(idNumber) });
    if (/^[+\d\s().-]+$/.test(text)) {
        const digits = text.replace(/\D/g, '');
        const local = digits.replace(/^250/, '').replace(/^0/, '') || digits;
        if (local) or.push({ telephone: contains(local) });
    }
    return Visitor.distinct('_id', { $or: or });
}

/** Time inside for visitors in house (8 hour stay limit), the stored duration otherwise. */
function withDuration(view, now = Date.now()) {
    const entered = view.entry_date ? new Date(view.entry_date).getTime() : NaN;
    if (view.is_still_inhouse && Number.isFinite(entered)) {
        const total = Math.max(0, Math.floor((now - entered) / 60000));
        const hours = Math.floor(total / 60);
        const minutes = total % 60;
        view.current_duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`;
        view.current_duration_hours = hours + minutes / 60;
        view.is_near_limit = view.current_duration_hours >= 7;
        view.is_over_limit = view.current_duration_hours >= 8;
        return view;
    }
    const vehicle = view.vehicle_storage || {};
    const stored = (vehicle.has_vehicle && vehicle.vehicle_details && vehicle.vehicle_details.duration)
        || (view.durations && view.durations.entry_and_leave_duration)
        || null;
    view.current_duration = stored || 'N/A';
    view.current_duration_hours = stored ? (parseFloat(stored) / 60 || 0) : 0;
    return view;
}

/**
 * GET /servicedelivery/assigned-visitors ?page &limit (<= 20) &q
 *     &in_house=true|false|all (absent = in house unless history=true)
 * The visits the caller sent to a department. Employees and heads of
 * department only see those that also went through their department scope.
 * q searches the visitor (name, telephone, ID number, email) and the
 * assignments (department and provider names).
 */
module.exports = async function assigned_visitors(req, res) {
    try {
        const { limit, page, q, in_house, history } = req.query || {};
        const pageNo = Math.max(1, parseInt(page, 10) || 1);
        const limitVal = Math.min(20, Math.max(1, parseInt(limit, 10) || 20));

        const filter = { 'departments_assigned.assigned_by.user_id': userIdOf(req.user) };
        if (in_house === 'true' || in_house === true) filter.is_still_inhouse = true;
        else if (in_house === 'false' || in_house === false) filter.is_still_inhouse = false;
        else if (in_house !== 'all' && history !== 'true') filter.is_still_inhouse = true;

        const slug = roleSlugOf(req);
        if (SCOPED_ROLES.includes(slug)) {
            const scope = await departmentScopeFor(req.user, slug);
            if (scope.length === 0) {
                if (slug === 'department-manager') {
                    throw forbidden('You are not assigned as a leader of any department', { type: 'error' });
                }
                return res.status(200).json({
                    success: true, type: 'success', message: 'Assigned visitors results', total: 0, page: pageNo, limit: limitVal, pages: 1, data: [],
                });
            }
            filter.departments_assigned = { $elemMatch: { department_id: { $in: scope } } };
        }

        const text = textOf(q);
        if (text) {
            const ids = await matchingVisitorIds(text);
            filter.$or = [
                { visitor: { $in: ids } },
                { 'departments_assigned.department_name': contains(text) },
                { 'departments_assigned.provider_name': contains(text) },
            ];
        }

        const [rows, total] = await Promise.all([
            ServiceDelivery.find(filter)
                .sort({ entry_date: -1, _id: -1 })
                .skip((pageNo - 1) * limitVal)
                .limit(limitVal)
                .populate('visitor')
                .lean(),
            ServiceDelivery.countDocuments(filter),
        ]);

        const now = Date.now();
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Assigned visitors results',
            total,
            page: pageNo,
            limit: limitVal,
            pages: Math.max(1, Math.ceil(total / limitVal)),
            data: rows.map((row) => withDuration(visitView(row), now)),
        });
    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving assigned visitors');
    }
};
