/**
 * To prevent app crash according to missed module we are overwritting require function
 * to don't crash an application but we do this with caution
 */
const Module = require('module')
const originalRequire = Module.prototype.require

let IS_ANY_MISSED_MODULES = false
let missed_modules = 0

Module.prototype.require = function(path) {
    try {
        // Attempt to load the module using the original Node.js logic
        return originalRequire.apply(this, arguments)
    } catch (error) {
        // We only intercept errors where the file physically does not exist
        if (error.code === 'MODULE_NOT_FOUND') {
            const caller_file = this.filename || 'Unknown Origin'
            if(caller_file.includes('node_modules')) {
                return null
            }
            IS_ANY_MISSED_MODULES = true
            missed_modules++

            // 'this.filename' provides the absolute path of the file that called require()
            console.error('--------------------------------------------------')
            console.error(`[REQUIRE ERROR]: Could not find ${path}`)
            console.error(`[IMPORTED FROM]: ${caller_file}`)
            console.error('--------------------------------------------------')

            console.log('\n')

            /**
             * Returning null allows the app to keep running.
             */
            return null
        }

        // Re-throw if the file EXISTS but has a Syntax Error or internal bug
        throw error
    }
}

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
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const http = require('http')
const path = require('path')

/**
 * Import Swagger UI and YAML loader
 * Serves interactive API documentation from api_description.yaml
 */
const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')

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

/**
 * Load the Swagger/OpenAPI spec from the YAML file.
 * The file must be in the same directory as this main.js file.
 * Path: ./api_description.yaml
 */
const swagger_document = YAML.load(path.join(__dirname, 'api_description.yaml'))

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

/**
 * Mount Swagger UI
 * Serves the interactive API documentation at /cok/api/docs
 *
 * To access: http://localhost:2026/cok/api/docs
 *
 * Options explained:
 * - explorer: true           → shows the search bar in the UI
 * - customSiteTitle          → sets the browser tab title
 * - swaggerOptions.tryItOutEnabled → auto-enables "Try it out" on all endpoints
 * - swaggerOptions.persistAuthorization → keeps the Bearer token across page refreshes
 * - swaggerOptions.displayRequestDuration → shows how long each test call took (ms)
 * - swaggerOptions.filter    → enables endpoint search/filtering by keyword
 * - swaggerOptions.docExpansion → "list" shows all endpoints collapsed by default
 */
app.use(
    '/cok/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swagger_document, {
        explorer: true,
        customSiteTitle: 'CoK HR API Docs',
        customCss: `
            .swagger-ui .topbar { background-color: #1a1a2e; }
            .swagger-ui .topbar .download-url-wrapper { display: none; }
            .swagger-ui .info .title { color: #1a1a2e; }
        `,
        swaggerOptions: {
            tryItOutEnabled: true,
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            docExpansion: 'list',
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
        }
    })
)

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
    res.status(404).json({
        success: false,
        type: 'warning',
        message: "[404] REQUESTED SERVICE NOT FOUND"
    })
})

/**
 * Global Error Middleware
 * Centralized error handling for all route failures
 */
app.use((err, req, res, next) => {
    res.status(500).json({
        success: false,
        type: "error",
        message: "Something got wrong please try again later!",
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
            console.log(`API Docs available at http://localhost:${PORT}/cok/api/docs`)

            if (IS_ANY_MISSED_MODULES) {
                console.log(`
                    
                    APPICATION IS RUNNING BUT ${missed_modules} MODULES MISSED WHICH MIGHT COUSE AN ERROR IN FUTURE
                    =============================================================================================
                    
                    `)
                console.log(`[CRITICAL ERROR] ${missed_modules} missed modules found.`)
            }
        })

    } else {
        console.log(response.error || '')
        process.exit(1)
    }
}).catch(error => {
    console.log(error)
    process.exit(1)
})