const RoleBased_Room = require('./../services/reatime_service/initialise_realtime_services.js').RoleBased_Room;
const Private_Room = require('./../services/reatime_service/initialise_realtime_services.js').Private_Room;

// Track WebSocket initialization status
let isWebSocketInitialized = false;

/**
 * Mark WebSocket as initialized
 */
function setWebSocketInitialized(status) {
    isWebSocketInitialized = status;
    console.log('[WebSocket] Initialization status:', status ? 'READY' : 'NOT READY');
}

/**
 * Get WebSocket initialization status
 */
function getWebSocketInitialized() {
    return isWebSocketInitialized;
}

/**
 * Emit to a specific system room
 * @param {object} io - Socket.IO instance (global.WebsocketIO)
 * @param {string} system - 'smart_parking' or 'service_delivery'
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
function emitToSystem(io, system, event, data) {
    // Add null check for io to prevent errors when WebSocket is not initialized
    if (!io) {
        console.warn('[WebSocket] Cannot emit to system: WebSocketIO is not initialized (null)');
        console.warn('[WebSocket] global.WebsocketIO value:', global.WebsocketIO);
        console.warn('[WebSocket] isWebSocketInitialized:', isWebSocketInitialized);
        return;
    }
    const room = `SYSTEM_${system}`;
    io.to(room).emit(event, data);
}

/**
 * Emit to multiple systems
 * @param {string[]} systems - Array of systems
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
function emitToSystems(io, systems, event, data) {
    // Add null check for io to prevent errors when WebSocket is not initialized
    if (!io) {
        console.warn('[WebSocket] Cannot emit to systems: WebSocketIO is not initialized (null)');
        return;
    }
    if (systems && systems.length > 0) {
        systems.forEach(system => {
            emitToSystem(io, system, event, data);
        });
    }
}

/**
 * Emit to specific user private room
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
function emitToUser(io, userId, event, data) {
    // Add null check for io to prevent errors when WebSocket is not initialized
    if (!io) {
        console.warn('[WebSocket] Cannot emit to user: WebSocketIO is not initialized (null)');
        return;
    }
    if (userId) {
        io.to(Private_Room(userId)).emit(event, data);
    }
}

/**
 * Legacy global emit (use sparingly)
 */
function emitGlobal(io, event, data) {
    // Add null check for io to prevent errors when WebSocket is not initialized
    if (!io) {
        console.warn('[WebSocket] Cannot emit globally: WebSocketIO is not initialized (null)');
        return;
    }
    io.emit(event, data);
}

module.exports = {
    emitToSystem,
    emitToSystems,
    emitToUser,
    emitGlobal,
    RoleBased_Room,
    Private_Room,
    setWebSocketInitialized,
    getWebSocketInitialized
};

