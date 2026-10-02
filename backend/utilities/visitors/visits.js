/**
 * Visit lifecycle. A visit (ServiceDelivery document) is opened when a
 * visitor arrives and closed when they leave. A visitor can have only one
 * open visit (unique partial index); Is_In_House mirrors that, and N_visits
 * counts every opened visit.
 */

const mongoose = require('mongoose');
const ServiceDelivery = require('../../models/service_delivery.js');
const ServiceTracking = require('../../models/service_tracking.js');
const Visitor = require('../../models/visitor.js');
const { notifyUsers } = require('../notify.js');
const { isDuplicateKey, conflict } = require('./errors.js');

const pad2 = (n) => String(n).padStart(2, '0');

/** DD/MM/YYYY HH:MM in Kigali time (UTC+2), for messages. */
function whenText(date) {
    if (!date) return '';
    const t = new Date(new Date(date).getTime() + 2 * 60 * 60 * 1000);
    return `${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()} ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
}

/** Refusal for an action on a visit that is already closed. */
function alreadyCheckedOut(visit, name = '') {
    const at = visit && visit.exist_date ? ` at ${whenText(visit.exist_date)}` : '';
    return conflict(`${name || 'This visitor'} already checked out${at}.`, { code: 'ALREADY_CHECKED_OUT' });
}

/** The person's name on a visit (the visitor, or the old fields of a legacy visit). */
async function visitorNameOf(visit) {
    if (!visit) return '';
    const named = await ServiceDelivery.findById(visit._id).populate('visitor', 'full_name').select('visitor full_name').lean();
    return (named && named.visitor && named.visitor.full_name) || (named && named.full_name) || '';
}

const minutesBetween = (from, to) => Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
const userName = (user) => (user && (user.name || user.full_name || user.fullName)) || 'Not specified';

function findOpenVisit(visitorId) {
    return ServiceDelivery.findOne({ visitor: visitorId, is_still_inhouse: true });
}

function latestVisit(visitorId) {
    return ServiceDelivery.findOne({ visitor: visitorId }).sort({ entry_date: -1 });
}

/**
 * Screens send either a visit id (what the visit lists return as _id, sent
 * as visitor_id for historical reasons) or a visitor id. Resolve both.
 * @param {boolean} options.open  when given a visitor id, only its open visit
 */
async function visitFromRef(id, { open = true } = {}) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
    const byVisit = await ServiceDelivery.findById(id);
    if (byVisit) return byVisit;
    const filter = { visitor: id };
    if (open) filter.is_still_inhouse = true;
    return ServiceDelivery.findOne(filter).sort({ entry_date: -1 });
}

/** Undo a visit opened by a check-in whose car could not be registered. */
async function rollbackOpenedVisit(visit) {
    if (!visit) return;
    await ServiceDelivery.deleteOne({ _id: visit._id });
    await Visitor.updateOne({ _id: visit.visitor, N_visits: { $gt: 0 } }, { $inc: { N_visits: -1 } });
    await refreshPresence(visit.visitor);
}

/** Is_In_House = the visitor has an open visit. */
async function refreshPresence(visitorId) {
    if (!visitorId) return false;
    const open = await ServiceDelivery.exists({ visitor: visitorId, is_still_inhouse: true });
    await Visitor.updateOne({ _id: visitorId }, { $set: { Is_In_House: !!open } });
    return !!open;
}

/** A check-in that does not open a visit still counts (staff cars). */
function countVisit(visitorId) {
    return Visitor.updateOne({ _id: visitorId }, { $inc: { N_visits: 1 } });
}

/**
 * Open a visit, or return the one already open.
 * @param {object} options.vehicle  { plate_number, parking_record } when the visitor came by car
 * @returns {Promise<{ visit, opened: boolean }>}
 */
async function openVisit({ visitor, user, vehicle = null, items = [], badge = null }) {
    const visitorId = visitor._id || visitor;
    const existing = await findOpenVisit(visitorId);
    if (existing) return { visit: existing, opened: false };

    const now = new Date();
    try {
        const visit = await ServiceDelivery.create({
            visitor: visitorId,
            registered_by: userName(user),
            entry_date: now,
            is_still_inhouse: true,
            vehicle_storage: vehicle
                ? {
                    has_vehicle: true,
                    parking_record: vehicle.parking_record || null,
                    vehicle_details: { plate_number: vehicle.plate_number, entered_time: now },
                }
                : { has_vehicle: false },
            items_entered_with: Array.isArray(items) ? items : [],
            badge_number: badge || null,
        });
        await Visitor.updateOne({ _id: visitorId }, { $set: { Is_In_House: true }, $inc: { N_visits: 1 } });
        return { visit, opened: true };
    } catch (error) {
        if (isDuplicateKey(error)) {
            const open = await findOpenVisit(visitorId);
            if (open) return { visit: open, opened: false };
        }
        throw error;
    }
}

/** Link a car to a visit that is already open. */
async function attachVehicle(visit, { plate_number, parking_record }) {
    visit.vehicle_storage = {
        has_vehicle: true,
        parking_record: parking_record || null,
        vehicle_details: { plate_number, entered_time: new Date() },
    };
    await visit.save();
    return visit;
}

/**
 * Stop whatever is still running in a visit (services and timers) the way a
 * forced exit always has: the service becomes Completed, the timer is closed,
 * a tracking row is written and the provider is told they forgot to stop it.
 */
async function stopRunningServices(visit, { visitorName = '', now = new Date() } = {}) {
    const running = (visit.services_status || []).filter((s) => s.s_type === 'Inprogress');
    for (const service of running) {
        const timer = (visit.durations.services_durations || []).find((d) =>
            !d.ended_at && String(d.department_id) === String(service.department_id));
        const assigned = (visit.departments_assigned || []).find((d) => String(d.department_id) === String(service.department_id));
        const started = (timer && timer.started_at) || (assigned && assigned.assigned_time) || visit.entry_date;
        const duration = `${minutesBetween(started, now)} mins`;
        if (timer) {
            timer.ended_at = now;
            timer.duration = duration;
        }
        await ServiceTracking.create({
            visitor: visit.visitor,
            service_delivery: visit._id,
            department_id: service.department_id,
            department_name: service.department_name,
            duration,
            started_at: started,
            ended_at: now,
            provider_name: service.provider_name || 'Not specified',
            provider_id: service.provider_id || 'Not specified',
        });
        if (service.provider_id) {
            notifyUsers({
                event: 'you_forgot_to_stop_service',
                to: [service.provider_id],
                type: 'warning',
                title: 'Service was not stopped',
                message: `You forgot to stop the service for visitor ${visitorName || 'Unknown'} in department ${service.department_name}. We stopped it for you. Please be careful next time.`,
                data: { visitor_id: String(visit.visitor || ''), visit_id: String(visit._id), department_name: service.department_name },
            }).catch((error) => console.error('Failed to notify provider:', error.message));
        }
        service.s_type = 'Completed';
    }
    (visit.durations.services_durations || []).forEach((d) => {
        if (!d.ended_at) {
            d.ended_at = now;
            d.duration = `${minutesBetween(d.started_at || now, now)} mins`;
        }
    });
    visit.is_being_served = false;
    visit.current_server = null;
}

/**
 * Close a visit: stop running services, record the exit time and the visit
 * duration, and refresh the visitor presence. Returns null when the visit
 * was already closed (nothing is done twice).
 */
async function closeVisit(visit, { visitorName = '', now = new Date(), vehicleDuration = null } = {}) {
    // Claim the open visit first: when two gates close it at once only one goes on
    const claimed = await ServiceDelivery.updateOne({ _id: visit._id, is_still_inhouse: true }, { $set: { is_still_inhouse: false, exist_date: now } });
    if (!claimed.modifiedCount) return null;
    await stopRunningServices(visit, { visitorName, now });
    visit.exist_date = now;
    visit.durations.entry_and_leave_duration = `${minutesBetween(visit.entry_date || now, now)} mins`;
    visit.is_still_inhouse = false;
    visit.marked_as_out = false;
    if (visit.vehicle_storage && visit.vehicle_storage.has_vehicle && visit.vehicle_storage.vehicle_details) {
        visit.vehicle_storage.vehicle_details.exited_time = now;
        if (vehicleDuration) visit.vehicle_storage.vehicle_details.duration = vehicleDuration;
    }
    await visit.save();
    await refreshPresence(visit.visitor);
    return visit;
}

module.exports = {
    whenText,
    alreadyCheckedOut,
    visitorNameOf,
    minutesBetween,
    userName,
    findOpenVisit,
    latestVisit,
    visitFromRef,
    rollbackOpenedVisit,
    refreshPresence,
    countVisit,
    openVisit,
    attachVehicle,
    stopRunningServices,
    closeVisit,
};
