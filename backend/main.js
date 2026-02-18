/**
 * Import database connection utility
 */
const db_connection = require("./db_connection/main");

/**
 * Load environment variables from .env file in silent mode
 */
require("dotenv").config({quiet: true});

/**
 * Import core dependencies
 */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

/**
 * Import the central routes
 */
const allRoutes = require('./routes/main.js');

/**
 * Initialize Express application and define Port
 */
const app = express();
const PORT = process.env.PORT || 2026;


/**
 * Configure Cross-Origin Resource Sharing (CORS)
 * Defines allowed origins and enables credential support (cookies/auth headers)
 */
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}));


/**
 * Global Middlewares
 * express.json: Parses incoming JSON payloads
 * express.urlencoded: Parses URL-encoded bodies
 * cookieParser: Parses Cookie header and populates req.cookies
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser(process.env.COOKIE_SECRET || 'extensible-cok-2026'));


/**
 * Mount System Routes
 * All modular routes are prefixed with /cok/api
 */
app.use('/cok/api', allRoutes);


/**
 * Standard 404 Handler
 * Catches any request that doesn't match a defined route
 */
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: "Endpoint notfound" });
});

/**
 * Global Error Middleware
 * Centralized error handling for all route failures
 */
app.use((err, req, res, next) => {
    
    
    res.status(500).json({
        success: false,
        message: err.message || "Something got wrong please try again later!",
    });
});


/**
 * Initialize Database Connection and Start Server
 * Ensures the app only listens if the database is successfully connected
 */
db_connection().then(response => {
    if(response.status) {
 console.log("Database connected.")
 app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

} else {
    console.log(response.error)
    process.exit(1)
}
}).catch(error => {
        console.log(error)
    process.exit(1)
})
