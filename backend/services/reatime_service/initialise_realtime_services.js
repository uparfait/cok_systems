/**
 * Initializes all real-time services by setting up WebSocket connections and handlers.
 * This module imports individual real-time handlers for different services (e.g., smart parking, service delivery)
 * and attaches them to the WebSocket server. It ensures that all real-time functionalities are centralized and easily maintainable.
 */

const smart_park_realtime = require('./smartparking/smartpark.js')
const service_delivery_realtime = require('./service_delivery/service_delivery.js')


/**
 * Initializes the WebSocket server and sets up real-time handlers for various services.
 * It listens for new WebSocket connections and attaches the appropriate handlers for each service.
 * @returns {Promise<boolean>} - Resolves to true if initialization is successful, otherwise false.
 */
module.exports = async function InitialiseAllRealtimeServices() {

    try {
        const io = WebsocketIO

        io.on('connection', (socket) => {
            console.log('A user connected to real-time services:', socket.id)
            socket.on('disconnect', () => {
                console.log('A user disconnected from real-time services:', socket.id)
            })

            socket.on('error', (error) => {
                console.error('WebSocket error on socket', socket.id, ':', error)
            })

            socket.on('connect_error', (error) => {
                console.error('WebSocket connection error on socket', socket.id, ':', error)
            })
            socket.on('connect_timeout', (timeout) => {
                console.error('WebSocket connection timeout on socket', socket.id, ':', timeout)
            })

            socket.on('ping', () => {
                console.log('Received ping from socket', socket.id)
                socket.emit('pong', { message: 'Pong from server!' })
            })



            // Initialize individual real-time handlers
            smart_park_realtime(socket)
            service_delivery_realtime(socket)
            // All other real-time handlers can be added here in the future as needed


        })

        console.log('All Real-time services initialized successfully.')
        return true
    }
    catch (error) {
        console.error('Error initializing real-time services:', error)
        return false
    }
}