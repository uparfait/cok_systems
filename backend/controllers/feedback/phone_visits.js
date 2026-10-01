/**
 * Lookups behind the public feedback pages. A visitor is known there by
 * telephone only: the number is normalised the way the visitor registry
 * stores it, the visitor holding it is found, and the departments offered
 * for feedback are those of that visitor's visits (latest visit first,
 * latest assignment first inside a visit, each department once with its
 * most recent assignment).
 */

const Visitor = require('../../models/visitor.js');
const ServiceDelivery = require('../../models/service_delivery.js');
const Feedback = require('../../models/feedback_db.js');
const { clean, normalizePhone } = require('../../utilities/visitors');

const RWANDA_LOCAL = /^07\d{8}$/;

const EMPTY_SUMMARY = Object.freeze({
    total_assigned_departments: 0,
    completed_feedback: 0,
    pending_feedback: 0,
    departments_with_feedback: [],
    pending_departments: [],
});

/**
 * Every form a saved copy of this number can have. New feedback holds the
 * normalised 07XXXXXXXX form; feedback saved before the visitor registry
 * holds the number as it was typed (+2507..., 2507..., 7...).
 */
function phoneForms(value) {
    const typed = clean(value);
    const phone = normalizePhone(value);
    const forms = new Set([typed, phone]);
    if (phone && RWANDA_LOCAL.test(phone)) {
        const local = phone.slice(1);
        [local, `250${local}`, `+250${local}`].forEach((form) => forms.add(form));
    } else if (phone) {
        const digits = phone.replace(/\D/g, '');
        [digits, `+${digits}`].forEach((form) => forms.add(form));
    }
    return [...forms].filter(Boolean);
}

/**
 * The registered visitor holding this telephone, or null. The $type
 * condition lets MongoDB use the unique partial index on telephone (its
 * filter is { $type: 'string' }); a plain equality scans the collection.
 */
async function visitorByPhone(value) {
    const telephone = normalizePhone(value);
    if (!telephone) return null;
    return Visitor.findOne({ telephone: { $eq: telephone, $type: 'string' } }).select('full_name telephone').lean();
}

function hasVisits(visitorId) {
    return ServiceDelivery.exists({ visitor: visitorId });
}

/**
 * One row per department the visitor was sent to, in the shape the public
 * pages read: { department_id, department_name, assigned_time, reached_in, provider_name }.
 * @param {string|null} departmentId  only this department
 */
function departmentStages(visitorId, departmentId = null) {
    const department = departmentId ? String(departmentId) : null;
    const visitMatch = { visitor: visitorId };
    if (department) visitMatch['departments_assigned.department_id'] = department;
    return [
        { $match: visitMatch },
        { $project: { entry_date: 1, departments_assigned: 1 } },
        { $unwind: { path: '$departments_assigned', includeArrayIndex: 'position' } },
        { $match: { 'departments_assigned.department_id': department || { $nin: [null, ''] } } },
        { $sort: { entry_date: -1, _id: -1, position: 1 } },
        {
            $group: {
                _id: '$departments_assigned.department_id',
                assignment: { $first: '$departments_assigned' },
                visit_id: { $first: '$_id' },
                visit_date: { $first: '$entry_date' },
                position: { $first: '$position' },
            },
        },
        { $sort: { visit_date: -1, visit_id: -1, position: 1 } },
        {
            $project: {
                _id: 0,
                department_id: '$_id',
                department_name: '$assignment.department_name',
                assigned_time: '$assignment.assigned_time',
                reached_in: '$assignment.reached_in',
                provider_name: '$assignment.provider_name',
            },
        },
    ];
}

/** Departments of all the visitor's visits, latest first. */
function visitDepartments(visitorId) {
    return ServiceDelivery.aggregate(departmentStages(visitorId));
}

/** The most recent assignment of one department in the visitor's visits, or null. */
async function latestAssignment(visitorId, departmentId) {
    const [row] = await ServiceDelivery.aggregate([...departmentStages(visitorId, departmentId), { $limit: 1 }]);
    return row || null;
}

/**
 * The visitor's departments split by whether feedback was already given for
 * them from this telephone (any of its saved forms).
 */
async function feedbackSummary(visitorId, phones) {
    if (!visitorId) return { ...EMPTY_SUMMARY };
    const [split] = await ServiceDelivery.aggregate([
        ...departmentStages(visitorId),
        {
            $lookup: {
                from: Feedback.collection.name,
                let: { department_id: '$department_id' },
                pipeline: [
                    { $match: { telephone: { $in: phones }, $expr: { $eq: ['$department_id', '$$department_id'] } } },
                    { $limit: 1 },
                    { $project: { _id: 1 } },
                ],
                as: 'feedback',
            },
        },
        { $project: { department_id: 1, department_name: 1, provider_name: 1, has_feedback: { $gt: [{ $size: '$feedback' }, 0] } } },
        {
            $facet: {
                departments_with_feedback: [{ $match: { has_feedback: true } }, { $project: { has_feedback: 0 } }],
                pending_departments: [{ $match: { has_feedback: false } }, { $project: { has_feedback: 0 } }],
            },
        },
    ]);
    const withFeedback = (split && split.departments_with_feedback) || [];
    const pending = (split && split.pending_departments) || [];
    return {
        total_assigned_departments: withFeedback.length + pending.length,
        completed_feedback: withFeedback.length,
        pending_feedback: pending.length,
        departments_with_feedback: withFeedback,
        pending_departments: pending,
    };
}

module.exports = {
    phoneForms,
    visitorByPhone,
    hasVisits,
    visitDepartments,
    latestAssignment,
    feedbackSummary,
};
