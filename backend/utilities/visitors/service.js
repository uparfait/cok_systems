/**
 * Serving rules for an open visit:
 *  - only one person serves a visitor at a time (atomic lock on
 *    is_being_served + current_server);
 *  - only the person serving can complete the service;
 *  - sending a visitor to a department is refused while someone serves them;
 *  - an employee can transfer a visitor they are serving (their service is
 *    closed as Transfered) or one nobody is serving.
 */

const mongoose = require('mongoose');
const ServiceDelivery = require('../../models/service_delivery.js');
const ServiceTracking = require('../../models/service_tracking.js');
const Department = require('../../models/department.js');
const { notifyUsers, getDepartmentRecipients } = require('../notify.js');
const { badRequest, conflict, forbidden, notFound } = require('./errors.js');
const { servingOf } = require('./serialize.js');
const { userIdOf } = require('./scope.js');
const { minutesBetween, userName } = require('./visits.js');
const { emitVisitorUpdated } = require('./realtime.js');

const stamp = (user) => ({ user_id: userIdOf(user) || null, name: userName(user), email: (user && user.email) || '' });

/** The caller's own department (their unit first), with its name. */
async function callerDepartment(user) {
    const unitId = user && user.department_unit ? String(user.department_unit) : null;
    const dept = user && user.department;
    const deptId = dept && typeof dept === 'object' ? dept._id : dept;
    const pick = async (id) => (id && mongoose.Types.ObjectId.isValid(id)
        ? Department.findById(id).select('department_name').lean()
        : null);
    const found = (await pick(unitId)) || (await pick(deptId ? String(deptId) : null));
    if (!found) throw notFound('Your department was not found. Ask the admin to set your department before serving visitors.');
    return { id: String(found._id), name: found.department_name, scope: [unitId, deptId && String(deptId)].filter(Boolean) };
}

async function openVisitOrFail(visitId) {
    const visit = await ServiceDelivery.findOne({ _id: visitId, is_still_inhouse: true });
    if (!visit) throw notFound('This visitor is not in house');
    return visit;
}

function emitStatus(visit, entry, status, user) {
    global.WebsocketIO?.emit('service_status_updated', {
        visitor_id: String(visit.visitor || ''),
        visit_id: String(visit._id),
        department_id: entry ? entry.department_id : null,
        department_name: entry ? entry.department_name : null,
        status,
        provider_name: userName(user),
    });
    emitVisitorUpdated(visit.visitor);
}

async function startService(visitId, user) {
    const me = userIdOf(user);
    const department = await callerDepartment(user);
    const now = new Date();
    const locked = await ServiceDelivery.findOneAndUpdate(
        { _id: visitId, is_still_inhouse: true, is_being_served: false },
        { $set: { is_being_served: true, current_server: { ...stamp(user), department_id: department.id, department_name: department.name, started_at: now } } },
        { returnDocument: 'after' },
    );
    if (!locked) {
        const current = await ServiceDelivery.findById(visitId).select('is_still_inhouse is_being_served current_server services_status').lean();
        if (!current || !current.is_still_inhouse) throw notFound('This visitor is not in house');
        const server = servingOf(current);
        throw conflict(`This visitor is being served by ${(server && server.name) || 'someone else'}`, { code: 'VISITOR_BEING_SERVED', serving_by: server });
    }

    try {
        const pending = (s) => s.s_type === 'Not started' && department.scope.includes(String(s.department_id));
        let entry = locked.services_status.find((s) => pending(s) && String(s.provider_id) === me)
            || locked.services_status.find(pending);
        if (!entry) {
            locked.departments_assigned.unshift({
                department_id: department.id,
                department_name: department.name,
                assigned_time: now,
                provider_name: userName(user),
                provider_id: me,
                reached_in: true,
                assigned_by: stamp(user),
            });
            locked.services_status.unshift({
                department_id: department.id,
                department_name: department.name,
                provider_name: userName(user),
                provider_id: me,
                s_type: 'Inprogress',
            });
            entry = locked.services_status[0];
        } else {
            entry.s_type = 'Inprogress';
            entry.provider_id = me;
            entry.provider_name = userName(user);
            const assignment = locked.departments_assigned.find((d) => String(d.department_id) === String(entry.department_id));
            if (assignment) {
                assignment.reached_in = true;
                assignment.provider_id = me;
                assignment.provider_name = userName(user);
            }
            locked.current_server.department_id = String(entry.department_id);
            locked.current_server.department_name = entry.department_name;
        }
        locked.durations.services_durations.unshift({
            department_id: String(entry.department_id),
            department_name: entry.department_name,
            started_at: now,
            ended_at: null,
            duration: null,
            provider_name: userName(user),
            provider_id: me,
        });
        await locked.save();
        emitStatus(locked, entry, 'Inprogress', user);
        return locked;
    } catch (error) {
        await ServiceDelivery.updateOne({ _id: visitId, 'current_server.user_id': me }, { $set: { is_being_served: false, current_server: null } });
        throw error;
    }
}

/** Close the caller's running service with the given final status. */
async function finishOwnService(visit, user, finalStatus, notes) {
    const me = userIdOf(user);
    const now = new Date();
    const entry = visit.services_status.find((s) => s.s_type === 'Inprogress' && String(s.provider_id) === me)
        || visit.services_status.find((s) => s.s_type === 'Inprogress');
    const timer = visit.durations.services_durations.find((d) => !d.ended_at && String(d.provider_id) === me);
    const started = (timer && timer.started_at) || (visit.current_server && visit.current_server.started_at) || now;
    const duration = `${minutesBetween(started, now)} mins`;
    if (timer) {
        timer.ended_at = now;
        timer.duration = duration;
    }
    if (entry) entry.s_type = finalStatus;
    await ServiceTracking.create({
        visitor: visit.visitor,
        service_delivery: visit._id,
        department_id: entry ? entry.department_id : (visit.current_server && visit.current_server.department_id),
        department_name: entry ? entry.department_name : (visit.current_server && visit.current_server.department_name),
        duration,
        started_at: started,
        ended_at: now,
        provider_name: userName(user),
        provider_id: me,
    });
    if (notes && String(notes).trim()) {
        visit.notes.push({ writter_name: userName(user), message: String(notes).trim(), timestamp: now });
    }
    visit.is_being_served = false;
    visit.current_server = null;
    return entry;
}

async function completeService(visitId, user, notes = null) {
    const visit = await openVisitOrFail(visitId);
    const server = servingOf(visit);
    if (!visit.is_being_served || !server) throw conflict('Nobody is serving this visitor right now');
    if (String(server.user_id) !== userIdOf(user)) {
        throw forbidden(`Only ${server.name || 'the person serving'} can complete this service`);
    }
    const entry = await finishOwnService(visit, user, 'Completed', notes);
    await visit.save();
    emitStatus(visit, entry, 'Completed', user);
    return visit;
}

/** Live queue of a department, for the assignment notification. */
async function buildDepartmentQueue(departmentId) {
    const rows = await ServiceDelivery.aggregate([
        { $match: { is_still_inhouse: true, 'departments_assigned.0.department_id': String(departmentId) } },
        { $addFields: { current: { $arrayElemAt: ['$departments_assigned', 0] } } },
        { $sort: { 'current.assigned_time': 1 } },
        { $lookup: { from: 'visitors', localField: 'visitor', foreignField: '_id', as: 'person' } },
        { $project: { is_being_served: 1, assigned_at: '$current.assigned_time', visitor_name: { $ifNull: [{ $arrayElemAt: ['$person.full_name', 0] }, 'Unknown visitor'] } } },
    ]);
    const queue = rows.map((row, index) => ({
        position: index + 1,
        visitor_name: row.visitor_name,
        status: row.is_being_served ? 'Being served' : 'Waiting',
        assigned_at: row.assigned_at || null,
    }));
    return { queue, assigned_total: queue.length, waiting_total: queue.filter((q) => q.status === 'Waiting').length };
}

async function notifyAssignment(visit, department, target, visitorName) {
    try {
        const recipients = await getDepartmentRecipients(target.department_id, target.provider_id || null);
        if (recipients.length === 0) return;
        const { queue, assigned_total, waiting_total } = await buildDepartmentQueue(target.department_id);
        const targetText = target.provider_id
            ? 'assigned to you'
            : `assigned to your ${department.is_unit ? 'unit' : 'department'} ${target.department_name}`;
        await notifyUsers({
            event: 'visitor_assigned',
            to: recipients,
            type: 'info',
            title: 'New visitor assigned',
            message: `Visitor ${visitorName || 'Unknown'} was ${targetText}. You now have ${assigned_total} assigned visitor${assigned_total === 1 ? '' : 's'} and ${waiting_total} waiting.`,
            data: {
                visitor_id: String(visit.visitor || ''),
                visit_id: String(visit._id),
                visitor_name: visitorName || '',
                department_id: String(target.department_id),
                department_name: target.department_name,
                provider_id: target.provider_id ? String(target.provider_id) : null,
                assigned_total,
                waiting_total,
                queue,
            },
            url: '/',
        });
    } catch (error) {
        console.error('Failed to notify assignment recipients:', error.message);
    }
}

/** The department a visitor is sent to must exist and have employees. */
async function validateTarget(target) {
    if (!target || !target.department_id || !mongoose.Types.ObjectId.isValid(target.department_id)) {
        throw badRequest('Choose a valid department');
    }
    if (target.provider_id && !mongoose.Types.ObjectId.isValid(target.provider_id)) {
        throw badRequest('Choose a valid employee');
    }
    const department = await Department.findById(target.department_id).select('department_name total_employees is_unit').lean();
    if (!department) throw notFound('Department not found');
    if (department.total_employees === 0) throw badRequest('There is no employee in this department');
    return department;
}

/**
 * Send an open visit to a department (optionally to one employee of it).
 * @param {object} target { department_id, department_name, provider_id?, provider_name? }
 */
async function assignVisit(visit, user, target, { visitorName = '' } = {}) {
    const department = await validateTarget(target);
    if (visit.is_being_served) {
        const server = servingOf(visit);
        throw conflict(`This visitor is being served by ${(server && server.name) || 'someone else'}. Wait until the service ends.`, { code: 'VISITOR_BEING_SERVED', serving_by: server });
    }
    const departmentName = target.department_name || department.department_name;
    const providerId = target.provider_id ? String(target.provider_id) : null;
    const providerName = providerId ? (target.provider_name || 'Not specified') : 'Not specified';
    // Sending again where the visitor already waits would only duplicate the request
    const waiting = (visit.services_status || []).find((s) => String(s.department_id) === String(target.department_id)
        && (s.s_type === 'Not started' || s.s_type === 'Inprogress')
        && (s.provider_id ? String(s.provider_id) : null) === providerId);
    if (waiting) {
        throw conflict(`This visitor is already waiting in ${departmentName}${providerId ? ` for ${providerName}` : ''}.`, { code: 'ALREADY_ASSIGNED' });
    }
    visit.departments_assigned.unshift({
        department_id: String(target.department_id),
        department_name: departmentName,
        assigned_time: new Date(),
        provider_name: providerName,
        provider_id: providerId,
        reached_in: false,
        assigned_by: stamp(user),
    });
    visit.services_status.unshift({
        department_id: String(target.department_id),
        department_name: departmentName,
        provider_name: providerName,
        provider_id: providerId,
        s_type: 'Not started',
    });
    visit.is_being_served = false;
    visit.current_server = null;
    await visit.save();
    await notifyAssignment(visit, department, { ...target, department_name: departmentName, provider_id: providerId }, visitorName);
    emitVisitorUpdated(visit.visitor);
    return visit;
}

/**
 * Employee transfer. Their own running service closes as Transfered and
 * their department's pending entries are marked Transfered too, then the
 * visitor is assigned to the target.
 */
async function transferService(visitId, user, target, { notes = null, visitorName = '' } = {}) {
    const visit = await openVisitOrFail(visitId);
    await validateTarget(target);
    const me = userIdOf(user);
    const server = servingOf(visit);
    if (visit.is_being_served && server && String(server.user_id) !== me) {
        throw conflict(`This visitor is being served by ${server.name || 'someone else'}`, { code: 'VISITOR_BEING_SERVED', serving_by: server });
    }
    if (visit.is_being_served) await finishOwnService(visit, user, 'Transfered', notes);
    else if (notes && String(notes).trim()) visit.notes.push({ writter_name: userName(user), message: String(notes).trim(), timestamp: new Date() });

    const department = await callerDepartment(user).catch(() => null);
    if (department) {
        visit.services_status.forEach((s) => {
            if (s.s_type === 'Not started' && department.scope.includes(String(s.department_id))) s.s_type = 'Transfered';
        });
    }
    return assignVisit(visit, user, target, { visitorName });
}

module.exports = {
    callerDepartment,
    startService,
    completeService,
    transferService,
    assignVisit,
    validateTarget,
    buildDepartmentQueue,
    openVisitOrFail,
};
