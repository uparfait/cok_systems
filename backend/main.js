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
const taskNotificationScheduler = require("./services/task_notification_scheduler.js");
const parkingMonitor = require("./utilities/parkingMonitor.js");
const Audit = require("./models/audit.js");
const User = require("./models/user.js");

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
const expressMung = require("express-mung");



async function LogSystemAuditEvent(req, data) {
  console.log(data)
  try {
    const auditData = {
      action: data.action,
      description: data.description,
      user_id: req.user?.id || req.user?._id || null,
      error: data.error || null,
      ip_address:
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        null,
      user_agent: req.get("User-Agent") || null,
      method: req.method,
      endpoint: req.originalUrl || req.url,
      status_code: data.status_code || null,
      old_values: data.old_values || null,
      new_values: data.new_values || null,
      error_message: data.error_message || null,
      metadata:  null,
    };

    if (auditData.user_id) {
      try {
        const user = await User.findById(auditData.user_id).select(
          "full_name email",
        );
        if (user) {
          auditData.user_name = user.full_name;
          auditData.user_email = user.email;
        }
      } catch (userError) {
        console.warn(
          "Could not fetch user details for audit log:",
          userError.message,
        );
      }
    }

    await Audit.create(auditData);
  } catch (error) {
    console.log("Error occurred while logging audit event:", error);
  }
}

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

// Automatically intercepts and modifies JSON responses
app.use(
  expressMung.json((body, req, res) => {
    try {
      /**
       * We are only going to skip logging audits for success status btn 200-209
       */

      if (res.statusCode > 300) {
        const action = body?.error?.toUpperCase() === "ERROR" ? req.method.toUpperCase() : req.method.toUpperCase();
        const description = body?.message || body?.error || "";
        const error_message = body?.error || "";
        const endpoint = req.originalUrl || req.url || "";
        const status_code = res.statusCode;
       
        LogSystemAuditEvent(
          req,

          {
            action: action,
            description: description,
            error: error_message,
            error_message: error_message,
            status_code: status_code,
            endpoint: endpoint,

          }
        )
        
      }

      return body;
    } catch (error) {
            if (res.statusCode > 300) {
        const action = body?.error?.toUpperCase() === "ERROR" ? req.method.toUpperCase() : req.method.toUpperCase();
        const description = body?.message || body?.error || "";
        const error_message = body?.error || "";
        const endpoint = req.originalUrl || req.url || "";
        const status_code = res.statusCode;
       
        LogSystemAuditEvent(
          req,

          {
            action: action,
            description: description,
            error: error_message,
            error_message: error_message,
            status_code: status_code,
            endpoint: endpoint,

          }
        )
        
      }
      return body;
    }
  }, {
    mungError: true,
  }),
);

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
// add static file serving middleware for the uploads/tasks/attachments directory
app.use(
  "/uploads/tasks/attachments",
  express.static(path.join(__dirname, "uploads/tasks/attachments")),
);
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
    const parkingSlotDoc = await ParkingSlot.findOne({
      UnChangedId: "parking_slots",
    });

    if (!!parkingSlotDoc?.unChangedId) {
      const newParkingSlot = new ParkingSlot({
        totalSlots: 0,
        visitorsReservedSlots: 0,
        staffReservedSlots: 0,
        visitorsAvailableSlots: 0,
        staffAvailableSlots: 0,
        RegularReservedSlots: 0,
        RegularAvailableSlots: 0,
      }); // commenting haardcoded values
      await newParkingSlot.save();
      console.log("Default parking slot document created.");
    } else {
      console.log("Parking slot document already exists.");
    }

    // Start task notification scheduler
    try {
      taskNotificationScheduler.start();
      console.log("Task notification scheduler started successfully.");
    } catch (schedulerError) {
      console.error(
        "Failed to start task notification scheduler:",
        schedulerError,
      );
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
          console.log(" Parking Monitor imported, but it is not a function.");
        }
      } catch (monitorError) {
        console.error(" Failed to start Parking Monitor:", monitorError);
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
