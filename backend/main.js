/**
 * Import database connection utility and real-time service initializer
 */
const db_connection = require("./db_connection/main")
const WebSocketService = require('./services/reatime_service/web_socket.js')
const InitialiseAllRealtimeServices = require('./services/reatime_service/initialise_realtime_services.js')

/**
 * Load environment variables from .env file in silent mode
 */
require("dotenv").config({ quiet: true })

/**
 * Import core dependencies
 */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http')
const multer = require('multer')


/**
 * Import the central routes
 */
const allRoutes = require('./routes/main.js')

/**
 * Initialize Express application and define Port
 */
const app = express()
const PORT = process.env.PORT || 2026
const server = http.createServer(app)
const web_socket_service = new WebSocketService(server)
const upload = multer()


/**
 * Configure Cross-Origin Resource Sharing (CORS)
 * Defines allowed origins and enables credential support (cookies/auth headers)
 */
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}))


/**
 * Global Middlewares
 * express.json: Parses incoming JSON payloads
 * express.urlencoded: Parses URL-encoded bodies
 * cookieParser: Parses Cookie header and populates req.cookies
 */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser(process.env.COOKIE_SECRET || 'extensible-cok-2026'))
app.use(upload.any())

/**
 * Mount System Routes
 * All modular routes are prefixed with /cok/api
 */
app.use('/cok/api', allRoutes)


/**
 * Standard 404 Handler
 * Catches any request that doesn't match a defined route
 */
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: "Endpoint notfound" })
})

/**
 * Global Error Middleware
 * Centralized error handling for all route failures
 */
app.use((err, req, res, next) => {


    res.status(500).json({
        success: false,
        type: "error",
        message:  "Something got wrong please try again later!",
        error: err.message || ""
    })
})


/**
 * Initialize Database Connection and Start Server
 * Ensures the app only listens if the database is successfully connected
 */
db_connection().then(async response => {

    const websocketInitiated = await web_socket_service.initWebsocket()
    const realtimeServicesInitiated = await InitialiseAllRealtimeServices()
    /**
     * Only start the server if both the database connection and WebSocket initialization are successful.
     */
    if (websocketInitiated && realtimeServicesInitiated && response.status) {
        console.log("Database connected.")
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`)
        })

    } else {
        console.log(response.error || '')
        process.exit(1)
    }
}).catch(error => {
    console.log(error)
    process.exit(1)
})
