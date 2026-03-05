const { Server } = require('socket.io')


/**
 * WebSocketService class encapsulates the initialization and management of WebSocket connections using Socket.IO.
 * It sets up the WebSocket server and provides a global reference for emitting events across the application.
 * Usage:
 * @const webSocketService = new WebSocketService(server)
 * @await webSocketService.initWebsocket()
 * @params server - The HTTP server instance to attach the WebSocket server to.
 * @returns {boolean} - Returns true if initialization is successful otherwise false.
 */

class WebSocketService {
    constructor(server) {
        this.server = server
    }

    /**
     * Initializes the WebSocket server and sets up CORS configuration.
     * It also assigns the Socket.IO instance to a global variable for easy access across the application.
     * @returns {Promise<boolean>} - Resolves to true if initialization is successful, otherwise false.
     */

    async initWebsocket() {
        try {
            if (!this.server) {
                console.error('HTTP server instance is required to initialize WebSocket server.')
                return false
            }
            
            const io = new Server(this.server, {
                cors: {
                    origin: process.env.CLIENT_URL_SET || ['https://cok-fr.vercel.app', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000'],
                    credentials: true
                }
            })
            global.WebsocketIO = io
            console.log('WebSocket server initialized successfully.')
            return true
        } catch (error) {
            console.error('Error initializing WebSocket server:', error)
            return false
        }
    }
}

module.exports = WebSocketService