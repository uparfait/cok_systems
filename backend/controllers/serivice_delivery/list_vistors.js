const ServiceDelivery = require('../../models/service_delivery.js');
const { departmentScopeFor, visitView, sendError, forbidden } = require('../../utilities/visitors');
const { roleSlugOf } = require('../visitors/permissions.js');

const getPeriodBounds = (period, from, to) => {
    const now = new Date();
    const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
    const endOfDay = (d) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };

    if (period === 'today') {
        return { start: startOfDay(now), end: endOfDay(now) };
    }
    if (period === 'week' || period === 'thisweek') {
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday };
    }
    if (period === 'lastweek' || period === 'last_week') {
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday };
    }
    if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    if (period === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    if (period === 'year') {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    if (period === 'range' && from) {
        const start = startOfDay(from);
        const end = to ? endOfDay(to) : endOfDay(now);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
        return { start, end };
    }
    return null;
};

// Roles whose lists are limited to their department scope
const SCOPED_ROLES = ['employee', 'department-manager'];

/**
 * Time inside for visitors in house (8 hour stay limit), the stored
 * duration for visits that are over.
 */
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
 * GET /servicedelivery/visitor ?in_house=true|false|all (default true) &page &limit (<= 50)
 *     &period=today|week|lastweek|month|last_month|year|range &from &to (entry date)
 * Visits newest first, each with the visitor's details. Employees see the
 * visits of their department and unit, heads of department those of the
 * departments they lead and their units; other roles see every visit.
 */
module.exports = async function list_visitors(req, res) {
    try {
        const { in_house = true, limit, page, period, from, to } = req.query || {};
        const pageNo = Math.max(1, parseInt(page, 10) || 1);
        const limitVal = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

        const filter = {};
        if (in_house === true || in_house === 'true') filter.is_still_inhouse = true;
        else if (in_house === false || in_house === 'false') filter.is_still_inhouse = false;

        const bounds = getPeriodBounds(period, from, to);
        if (bounds) filter.entry_date = { $gte: bounds.start, $lte: bounds.end };

        const slug = roleSlugOf(req);
        if (SCOPED_ROLES.includes(slug)) {
            const scope = await departmentScopeFor(req.user, slug);
            if (scope.length === 0) {
                if (slug === 'department-manager') {
                    throw forbidden('You are not assigned as a leader of any department', { type: 'error' });
                }
                return res.status(200).json({
                    success: true, type: 'success', message: 'Visitors results', total: 0, page: pageNo, limit: limitVal, pages: 1, data: [],
                });
            }
            filter.departments_assigned = { $elemMatch: { department_id: { $in: scope } } };
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
            message: 'Visitors results',
            total,
            page: pageNo,
            limit: limitVal,
            pages: Math.max(1, Math.ceil(total / limitVal)),
            data: rows.map((row) => withDuration(visitView(row), now)),
        });
    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving visitors');
    }
};
