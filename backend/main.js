/**
 * To prevent app crash according to missed module we are overwritting require function
 * to don't crash an application but we do this with caution.
 */

process.env.WS_NO_BUFFER_UTIL = "true";
process.env.WS_NO_UTF_8_VALIDATE = "true";



const Module = require("module");
const originalRequire = Module.prototype.require;

let IS_ANY_MISSED_MODULES = false;
let missed_modules = 0;

Module.prototype.require = function (path) {
  try {
    // Attempt to load the module using the original Node.js logic
    return originalRequire.apply(this, arguments);
  } catch (error) {
    // We only intercept errors where the file physically does not exist
    if (error.code === "MODULE_NOT_FOUND") {
      const caller_file = this.filename || "Unknown Origin";
      if (caller_file.includes("node_modules")) {
        return null;
      }
      IS_ANY_MISSED_MODULES = true;
      missed_modules++;

      // 'this.filename' provides the absolute path of the file that called require()
      console.error("--------------------------------------------------");
      console.error(`[REQUIRE ERROR]: Could not find ${path}`);
      console.error(`[IMPORTED FROM]: ${caller_file}`);
      console.error("--------------------------------------------------");

      console.log("\n");

      /**
       * Returning null allows the app to keep running.
       */
      return null;
    }

    // Re-throw if the file EXISTS but has a Syntax Error or internal bug
    throw error;
  }
};

/**
 * Import database connection utility and real-time service initializer
 */
const db_connection = require("./db_connection/main");
const WebSocketService = require("./services/reatime_service/web_socket.js");
const InitialiseAllRealtimeServices = require("./services/reatime_service/initialise_realtime_services.js");
const parkingMonitor = require("./utilities/parkingMonitor.js");

const ParkingSlot = require("./models/parking_slots.js");

/**
 * Load environment variables from .env file in silent mode
 */
require("dotenv").config({ quiet: true });

/**
 * Import core dependencies
 */
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const path = require("path");

/**
 * Import the central routes
 */
const allRoutes = require("./routes/main.js");

/**
 * Initialize Express application and define Port
 */
const app = express();
const PORT = process.env.PORT || 2026;
const server = http.createServer(app);
const web_socket_service = new WebSocketService(server);


/**
 * Configure Cross-Origin Resource Sharing (CORS)
 * Defines allowed origins and enables credential support (cookies/auth headers)
 */
app.use(
  cors({
    origin: process.env.CLIENT_URL_SET || [
      "https://cok-fr.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5000",
    ],
    credentials: true,
  }),
);

/**
 * Global Middlewares
 * express.json: Parses incoming JSON payloads
 * express.urlencoded: Parses URL-encoded bodies
 * cookieParser: Parses Cookie header and populates req.cookies
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || "extensible-cok-2026"));

/**
 * Mount System Routes
 * All modular routes are prefixed with /cok/api
 */
// Set x-powered-by header to 'Linux-sys' to hidden technology stack
app.set("x-powered-by", "Linux-sys");
app.use("/cok/api", allRoutes);

/**
 * Standard 404 Handler
 * Catches any request that doesn't match a defined route
 */
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    type: "warning",
    message: "[404] REQUESTED SERVICE NOT FOUND",
  });
});

/**
 * Global Error Middleware
 * Centralized error handling for all route failures
 */
app.use((err, req, res, next) => {
  res.status(500).json({
    success: false,
    type: "error",
    message: "Something got wrong please try again later!",
    error: err.message || "",
  });
});

/**
 * Initialize Database Connection and Start Server
 * Ensures the app only listens if the database is successfully connected
 */
db_connection()
  .then(async (response) => {
    const websocketInitiated = await web_socket_service.initWebsocket();
    const realtimeServicesInitiated = await InitialiseAllRealtimeServices();

    // check if parking slot document exists, if not create one with default values
    // default will be 350 total slots, 50 reserved for visitors, 100 reserved for staff, 100 available for visitors, 100 available for staff and 100 regular available slots
    const parkingSlotDoc = await ParkingSlot.findOne({ UnChangedId: "parking_slots" });
    if (!parkingSlotDoc) {
      const newParkingSlot = new ParkingSlot({
        totalSlots: 350,
        visitorsReservedSlots: 50,
        staffReservedSlots: 100,
        visitorsAvailableSlots: 50,
        staffAvailableSlots: 100,
        RegularReservedSlots: 200,
        RegularAvailableSlots: 200,
      });
      await newParkingSlot.save();
      console.log("Default parking slot document created.");
    } else {
      console.log("Parking slot document already exists.");
    }

    /**
     * Only start the server if both the database connection and WebSocket initialization are successful.
     */
    if (websocketInitiated && realtimeServicesInitiated && response.status) {
      console.log("Database connected.");
      //  START THE BACKGROUND MONITOR
      // We wrap this in a try-catch so if the monitor has a bug, it doesn't prevent the server from starting!
      try {
        // Check if parkingMonitor is directly a function
        if (typeof parkingMonitor === "function") {
          parkingMonitor(); // Call it directly!
          console.log(
            "Parking Monitor background service started successfully.",
          );
        } else {
          console.log("⚠️ Parking Monitor imported, but it is not a function.");
        }
      } catch (monitorError) {
        console.error("⚠️ Failed to start Parking Monitor:", monitorError);
      }

      server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);

        if (IS_ANY_MISSED_MODULES) {
          console.log(`
                    
                    APPLICATION IS RUNNING BUT ${missed_modules} MODULES MISSED WHICH MIGHT CAUSE AN ERROR IN FUTURE
                    =============================================================================================
                    
                    `);
          console.log(
            `[CRITICAL ERROR] ${missed_modules} missed modules found.`,
          );
        }
      });
    } else {
      console.log(response.error || "");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
