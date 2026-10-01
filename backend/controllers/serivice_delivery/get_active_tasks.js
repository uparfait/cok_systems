const ServiceDelivery = require('../../models/service_delivery.js');
const Visitor = require('../../models/visitor.js');
const {
    escapeRegex, normalizeIdNumber, departmentScopeFor, visitView, sendError, forbidden,
} = require('../../utilities/visitors');
const { roleSlugOf } = require('../visitors/permissions.js');

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

/** How long the visitor has been inside, as "Xh Ym" / "N mins" and in hours. */
function timeInside(entryDate, now) {
    const entered = entryDate ? new Date(entryDate).getTime() : NaN;
    if (!Number.isFinite(entered)) return null;
    const total = Math.max(0, Math.floor((now - entered) / 60000));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return { text: hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`, hours: hours + minutes / 60 };
}

/**
 * GET /servicedelivery/visitor/active-tasks ?page &limit (default 10, <= 50) &search
 * Head of department only: visitors in house being served right now whose
 * visit went through the departments they lead (and their units). search
 * looks at the visitor (name, telephone, ID number, email).
 */
module.exports = async function get_active_tasks(req, res) {
    try {
        const { limit, page, search } = req.query || {};
        const slug = roleSlugOf(req);
        if (slug !== 'department-manager') {
            throw forbidden('Access denied. Only Head of Department can view active tasks.', { type: 'error' });
        }

        const pageNo = Math.max(1, parseInt(page, 10) || 1);
        const limitVal = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

        const scope = await departmentScopeFor(req.user, slug);
        if (scope.length === 0) {
            throw forbidden('You are not assigned as a leader of any department', { type: 'error' });
        }

        const filter = {
            is_being_served: true,
            is_still_inhouse: true,
            departments_assigned: { $elemMatch: { department_id: { $in: scope } } },
        };
        const text = textOf(search);
        if (text) filter.visitor = { $in: await matchingVisitorIds(text) };

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
        const data = rows.map((row) => {
            const view = visitView(row);
            const inside = timeInside(view.entry_date, now);
            if (inside) {
                view.current_duration = inside.text;
                view.current_duration_hours = inside.hours;
            }
            if (view.serving_by) {
                view.current_service_department = view.serving_by.department_name;
                view.current_service_provider = view.serving_by.name;
            }
            const assignment = (view.departments_assigned || []).find((d) => scope.includes(String(d.department_id)));
            if (assignment) {
                view.assigned_department = assignment.department_name;
                view.assigned_time = assignment.assigned_time;
            }
            return view;
        });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Active tasks retrieved successfully',
            total,
            page: pageNo,
            limit: limitVal,
            pages: Math.max(1, Math.ceil(total / limitVal)),
            data,
        });
    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving active tasks');
    }
};
