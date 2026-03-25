/**
 * Smart Parking Real-time Handler
 * Handles WebSocket events for smart parking features
 */

/**
 * Middleware to check if socket is authenticated
 * @param {object} socket - Socket instance
 * @returns {object} - { isAuthenticated: boolean, user: object|null }
 */
function checkAuth(socket) {
    if (!socket.user) {
        return { isAuthenticated: false, user: null };
    }
    return { isAuthenticated: true, user: socket.user };
}

async function HandleReatime(socket) {
    // Test event - available to all users (authenticated or not)
    socket.on('smartparking_test', (data, callback) => {
        const auth = checkAuth(socket);
        
        if (callback) {
            callback({ 
                message: 'Data received successfully!',
                authenticated: auth.isAuthenticated,
                user: auth.isAuthenticated ? auth.user.email : null
            });
        }
    })

    // Get current parking status - requires authentication
    socket.on('get_parking_status', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ 
                success: false, 
                message: "Authentication required. Please login first." 
            });
        }

        // Here you could fetch actual parking data from the database
        // For now, just acknowledge the request
        return callback({
            success: true,
            message: "Parking status endpoint",
            user: auth.user.email
        });
    });

    // Send test message only to authenticated users
    if (socket.user && global.WebsocketIO) {
        global.WebsocketIO.emit('smartparking_test', { 
            message: 'This is a real-time update from the server!',
            authenticated: true,
            user: socket.user.email
        });
    } else if (global.WebsocketIO) {
        // Unauthenticated users get a generic message
        global.WebsocketIO.emit('smartparking_test', { 
            message: 'Connected to Smart Parking service',
            authenticated: false
        });
    }

}

module.exports = HandleReatime