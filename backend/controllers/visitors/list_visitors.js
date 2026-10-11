const mongoose = require('mongoose');
const Visitor = require('../../models/visitor.js');
const ServiceDelivery = require('../../models/service_delivery.js');
const {
    escapeRegex, normalizeIdNumber, normalizeEmail, normalizeGender, visitorView, servingOf, departmentScopeFor, sendError,
} = require('../../utilities/visitors');
const { roleSlugOf } = require('./permissions.js');

const SORTABLE = {
    full_name: 'full_name',
    id_type: 'identification.id_type',
    id_number: 'identification.number',
    telephone: 'telephone',
    email: 'email',
    gender: 'gender',
    n_visits: 'N_visits',
    N_visits: 'N_visits',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
};

const contains = (value) => ({ $regex: escapeRegex(value), $options: 'i' });

function dateRange(from, to) {
    const range = {};
    const start = from ? new Date(from) : null;
    const end = to ? new Date(to) : null;
    if (start && !Number.isNaN(start.getTime())) range.$gte = start;
    if (end && !Number.isNaN(end.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) end.setHours(23, 59, 59, 999);
        range.$lte = end;
    }
    return Object.keys(range).length ? range : null;
}

function buildMatch(q) {
    const match = {};
    if (q.presence === 'not_in_house') match.Is_In_House = false;
    else if (q.presence !== 'all') match.Is_In_House = true;

    const updated = dateRange(q.from, q.to);
    if (updated) match.updatedAt = updated;

    if (q.full_name) match.full_name = contains(q.full_name);
    if (q.id_type && q.id_type !== 'ALL') match['identification.id_type'] = q.id_type;
    if (q.id_number) match['identification.number'] = contains(normalizeIdNumber(q.id_number));
    if (q.telephone) {
        const digits = String(q.telephone).replace(/\D/g, '');
        if (digits) match.telephone = contains(digits.replace(/^250/, '').replace(/^0/, ''));
    }
    if (q.email) match.email = contains(normalizeEmail(q.email));
    if (q.gender && q.gender !== 'ALL') {
        const gender = normalizeGender(q.gender);
        if (gender) match.gender = gender;
    }
    if (q.n_visits !== undefined && q.n_visits !== '') {
        const n = Number(q.n_visits);
        if (!Number.isNaN(n)) {
            const op = q.n_visits_mode === 'is' ? '$eq' : q.n_visits_mode === 'max' ? '$lte' : '$gte';
            match.N_visits = { [op]: n };
        }
    }
    return match;
}

function currentVisitOf(visit) {
    if (!visit) return null;
    const current = (visit.departments_assigned || [])[0] || null;
    const status = (visit.services_status || [])[0] || null;
    return {
        _id: visit._id,
        entry_date: visit.entry_date,
        department_name: current ? current.department_name : '',
        provider_name: current && current.provider_id ? current.provider_name : '',
        status: status ? status.s_type : 'Not assigned',
        is_being_served: !!visit.is_being_served,
        serving_by: servingOf(visit),
        has_vehicle: !!(visit.vehicle_storage && visit.vehicle_storage.has_vehicle),
        plate_number: (visit.vehicle_storage && visit.vehicle_storage.vehicle_details && visit.vehicle_storage.vehicle_details.plate_number) || '',
        marked_as_out: !!visit.marked_as_out,
        attachments_count: visit.attachments_count || 0,
    };
}

/**
 * The visits behind an overview card: people who visited in the range, people
 * served (a service completed in the range), people with a request not served
 * yet (assigned in the range). Returns a ServiceDelivery filter or null.
 */
function viewFilter(view, range) {
    const inRange = range || { $type: 'date' };
    if (view === 'visited') return { entry_date: inRange };
    if (view === 'served') return { 'durations.services_durations': { $elemMatch: { started_at: inRange, ended_at: { $type: 'date' } } } };
    if (view === 'not_served') {
        return {
            services_status: { $elemMatch: { s_type: { $in: ['Not started', 'Inprogress'] } } },
            $or: [{ 'departments_assigned.assigned_time': inRange }, { entry_date: inRange }],
        };
    }
    return null;
}

/**
 * GET /visitors - one page of visitors (in-house first, newest update first)
 * with their open visit. Filters mirror the table header filters; view +
 * view_from / view_to pick the people behind an overview card.
 */
module.exports = async function list_visitors(req, res) {
    try {
        const q = req.query || {};
        const page = Math.max(1, parseInt(q.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
        const match = buildMatch(q);
        const idSets = [];

        if (q.scope === 'mine') {
            const scope = await departmentScopeFor(req.user, roleSlugOf(req));
            const visitFilter = { 'departments_assigned.department_id': { $in: scope } };
            if (match.Is_In_House === true) visitFilter.is_still_inhouse = true;
            idSets.push(scope.length ? await ServiceDelivery.distinct('visitor', visitFilter) : []);
        }
        const byView = viewFilter(q.view, dateRange(q.view_from, q.view_to));
        if (byView) idSets.push(await ServiceDelivery.distinct('visitor', byView));
        if (idSets.length) {
            const allowed = idSets.map((ids) => new Set(ids.filter(Boolean).map(String)));
            const ids = [...allowed[0]].filter((id) => allowed.every((set) => set.has(id)));
            match._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
        }

        const field = SORTABLE[q.sort];
        const dir = q.dir === 'asc' ? 1 : -1;
        const sort = field ? { Is_In_House: -1, [field]: dir, _id: -1 } : { Is_In_House: -1, updatedAt: -1, _id: -1 };

        const [result] = await Visitor.aggregate([
            { $match: match },
            { $sort: sort },
            {
                $facet: {
                    data: [
                        { $skip: (page - 1) * limit },
                        { $limit: limit },
                        {
                            $lookup: {
                                from: 'servicedeliveries',
                                localField: '_id',
                                foreignField: 'visitor',
                                pipeline: [
                                    { $match: { is_still_inhouse: true } },
                                    { $sort: { entry_date: -1 } },
                                    { $limit: 1 },
                                    {
                                        $project: {
                                            entry_date: 1, is_being_served: 1, current_server: 1, marked_as_out: 1,
                                            vehicle_storage: 1, services_status: { $slice: ['$services_status', 1] },
                                            departments_assigned: { $slice: ['$departments_assigned', 1] },
                                            attachments_count: { $size: { $ifNull: ['$attachments', []] } },
                                        },
                                    },
                                ],
                                as: 'open_visit',
                            },
                        },
                    ],
                    total: [{ $count: 'n' }],
                },
            },
        ]);

        const total = (result && result.total[0] && result.total[0].n) || 0;
        const data = ((result && result.data) || []).map((row) => ({
            ...visitorView(row),
            current_visit: currentVisitOf(row.open_visit && row.open_visit[0]),
        }));

        return res.status(200).json({
            success: true,
            type: 'success',
            data,
            pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load visitors');
    }
};
