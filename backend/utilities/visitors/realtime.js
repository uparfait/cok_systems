/**
 * Broadcasts that tell open screens to reload one visitor. Payloads carry
 * ids only, never personal details. Both events are listed in
 * events.socket.json (backend root and frontend constants).
 */

function emitVisitorUpdated(visitorId, extra = {}) {
    if (!visitorId || !global.WebsocketIO) return;
    global.WebsocketIO.emit('visitor_updated', { show_notif: false, type: 'info', visitor_id: String(visitorId), ...extra });
}

function emitAttachmentsUpdated(visitorId, visitId) {
    if (!visitorId || !global.WebsocketIO) return;
    global.WebsocketIO.emit('visitor_attachments_updated', {
        show_notif: false,
        type: 'info',
        visitor_id: String(visitorId),
        visit_id: visitId ? String(visitId) : null,
    });
}

module.exports = {
    emitVisitorUpdated,
    emitAttachmentsUpdated,
};
