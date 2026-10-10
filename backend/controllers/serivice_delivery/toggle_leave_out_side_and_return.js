const ServiceDelivery = require('../../models/service_delivery.js');
const {
    visitFromRef, visitView, emitVisitorUpdated, userIdOf, userName, minutesBetween, sendError, badRequest, notFound,
} = require('../../utilities/visitors');

const LEAVE_OUTSIDE = 'Leave outside';

/** Items carried out, as [{ item_name, quantity, description? }]; rows without a name are dropped. */
function itemsFrom(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter((item) => item && typeof item === 'object' && String(item.item_name || '').trim())
        .map((item) => {
            const quantity = Number(item.quantity);
            const row = { item_name: String(item.item_name).trim(), quantity: Number.isFinite(quantity) ? quantity : 1 };
            if (item.description && String(item.description).trim()) row.description = String(item.description).trim();
            return row;
        });
}

/**
 * POST /servicedelivery/visitor/emergency/leave-return
 * Body: { visitor_id (a visit id or a visitor id), action: 'leave' | 'return', items_exited_with?, message? }
 * A visitor who came by car steps outside for a while and comes back.
 * leave: opens a 'Leave outside' period and marks the visit as out (refused
 * while a period is already open). return: closes the open period with its
 * duration and marks the visit back in (refused when none is open). Only
 * visits with a vehicle. The period and the note are recorded under the
 * signed-in user.
 */
module.exports = async function toggle_temporary_leave(req, res) {
    try {
        const body = req.body || {};
        const ref = body.visit_id || body.visitor_id || null;
        const action = String(body.action || '').trim().toLowerCase();
        if (!ref || !action) throw badRequest("Visitor ID and Action ('leave' or 'return') required");
        if (action !== 'leave' && action !== 'return') throw badRequest("Invalid action. Use 'leave' or 'return'.");

        const visit = await visitFromRef(ref);
        if (!visit || !visit.is_still_inhouse) throw notFound('Active visitor not found');
        if (!visit.vehicle_storage || !visit.vehicle_storage.has_vehicle) {
            throw badRequest('This action requires a visitor with a vehicle.');
        }

        const now = new Date();
        const by = { provider_name: userName(req.user), provider_id: userIdOf(req.user) || null };
        const periods = visit.durations.emergency_durations;
        const open = periods.find((p) => p.type_of_emergency === LEAVE_OUTSIDE && !p.ended_at);
        const addNote = (fallback) => visit.notes.push({
            writter_name: by.provider_name,
            message: String(body.message || '').trim() || fallback,
            timestamp: now,
        });

        if (action === 'leave') {
            if (open) throw badRequest('Visitor is already marked as outside.');
            periods.push({ type_of_emergency: LEAVE_OUTSIDE, started_at: now, ...by });
            const items = itemsFrom(body.items_exited_with);
            if (items.length) visit.items_exited_with.push(...items);
            addNote('Visitor stepped outside temporarily.');
            visit.marked_as_out = true;
        } else {
            if (!open) throw badRequest("No active 'Leave outside' record found to close.");
            const minutes = minutesBetween(open.started_at, now);
            open.ended_at = now;
            open.duration = `${minutes} mins`;
            addNote(`Visitor returned inside after ${minutes} minutes.`);
            visit.marked_as_out = false;
        }
        await visit.save();

        const data = visitView(await ServiceDelivery.findById(visit._id).populate('visitor').lean());
        const details = visit.vehicle_storage.vehicle_details || {};
        global.WebsocketIO?.emit('leave_return', {
            show_notif: true,
            type: 'info',
            visitor_id: data.visitor_id ? String(data.visitor_id) : null,
            visit_id: String(visit._id),
            message: `Visitor ${data.full_name || 'Unknown'} with plate number ${details.plate_number || 'not specified'} has ${action === 'leave' ? 'stepped outside temporarily.' : 'returned inside.'}`,
        });
        emitVisitorUpdated(visit.visitor);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: action === 'leave' ? 'Visitor marked as temporarily outside.' : 'Visitor marked as returned.',
            data,
        });
    } catch (error) {
        return sendError(res, error, 'Failed to log temporary leave');
    }
};
