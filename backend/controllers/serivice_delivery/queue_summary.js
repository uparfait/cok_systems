const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');
const { sendError } = require('../../utilities/visitors');
const {
    CLOSED_STATES, callerScope, pendingFor, servingFor, presenceFilter,
} = require('./get_visitors_by_department_current.js');

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Waiting and being-served visits of each unit (one row per unit that has any). */
function countsPerUnit(presence, unitIds) {
    return ServiceDelivery.aggregate([
        { $match: { ...presence, ...pendingFor(unitIds) } },
        { $project: { services_status: 1 } },
        { $unwind: '$services_status' },
        { $match: { 'services_status.department_id': { $in: unitIds }, 'services_status.s_type': { $nin: CLOSED_STATES } } },
        {
            $group: {
                _id: { unit: '$services_status.department_id', visit: '$_id' },
                serving: { $max: { $cond: [{ $eq: ['$services_status.s_type', 'Inprogress'] }, 1, 0] } },
            },
        },
        { $group: { _id: '$_id.unit', total_assigned: { $sum: 1 }, currently_serving: { $sum: '$serving' } } },
    ]);
}

/**
 * GET /servicedelivery/queue-summary?in_house=true
 * The figures next to the department queue, for the caller's department
 * scope (the same visits the queue lists): visitors waiting or being served,
 * visitors being served right now, and those two figures for each unit
 * under the caller's departments (new parent_department and legacy
 * sub_department_mng units).
 */
module.exports = async function queue_summary(req, res) {
    const summary = {
        success: true,
        type: 'success',
        message: 'Queue summary results',
        is_parent_department: false,
        total_units: 0,
        visitors_in_department: 0,
        currently_serving: 0,
        completed_in_department: 0,
        transferred_in_department: 0,
        units: [],
    };
    try {
        const presence = presenceFilter(req.query || {});
        const scope = await callerScope(req);
        if (scope.length === 0) return res.status(200).json(summary);

        const units = await Department.find({
            $or: [
                { parent_department: { $in: scope.filter((id) => OBJECT_ID.test(id)) } },
                { 'sub_department_mng.parent_department_id': { $in: scope } },
            ],
        }).select('department_name').sort({ department_name: 1 }).lean();
        const unitIds = units.map((unit) => String(unit._id));

        // Visits whose service in the caller's departments ended one way or the other
        const endedAs = (state) => ({ ...presence, services_status: { $elemMatch: { department_id: { $in: scope }, s_type: state } } });
        const [waiting, serving, perUnit, completed, transferred] = await Promise.all([
            ServiceDelivery.countDocuments({ ...presence, ...pendingFor(scope) }),
            ServiceDelivery.countDocuments({ ...presence, ...servingFor(scope) }),
            unitIds.length ? countsPerUnit(presence, unitIds) : Promise.resolve([]),
            ServiceDelivery.countDocuments(endedAs('Completed')),
            ServiceDelivery.countDocuments(endedAs('Transfered')),
        ]);
        const byUnit = new Map(perUnit.map((row) => [String(row._id), row]));

        return res.status(200).json({
            ...summary,
            is_parent_department: units.length > 0,
            total_units: units.length,
            visitors_in_department: waiting,
            currently_serving: serving,
            completed_in_department: completed,
            transferred_in_department: transferred,
            units: units.map((unit) => {
                const counts = byUnit.get(String(unit._id));
                return {
                    unit_id: String(unit._id),
                    unit_name: unit.department_name || '',
                    total_assigned: counts ? counts.total_assigned : 0,
                    currently_serving: counts ? counts.currently_serving : 0,
                };
            }),
        });
    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving queue summary');
    }
};
