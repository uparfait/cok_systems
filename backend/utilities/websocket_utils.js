const RoleBased_Room = require('./../services/reatime_service/initialise_realtime_services.js').RoleBased_Room;
const Private_Room = require('./../services/reatime_service/initialise_realtime_services.js').Private_Room;

/**
 * Emit to a specific system room
 * @param {object} io - Socket.IO instance (global.WebsocketIO)
 * @param {string} system - 'smart_parking' or 'service_delivery'
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
function emitToSystem(io, system, event, data) {
    if (io) {
        const room = `SYSTEM_${system}`;
        io.to(room).emit(event, data);
    }
}

/**
 * Emit to multiple systems
 * @param {string[]} systems - Array of systems
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
function emitToSystems(io, systems, event, data) {
    if (io && systems && systems.length > 0) {
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
    if (io && userId) {
        io.to(Private_Room(userId)).emit(event, data);
    }
}

/**
 * Legacy global emit (use sparingly)
 */
function emitGlobal(io, event, data) {
    if (io) {
        io.emit(event, data);
    }
}

module.exports = {
    emitToSystem,
    emitToSystems,
    emitToUser,
    emitGlobal,
    RoleBased_Room,
    Private_Room
};

