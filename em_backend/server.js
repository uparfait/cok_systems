/**
 * To prevent app crash according to missed module we are over-writing require function
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

const app = require("./app");
const config = require("./configurations/config");
const logger = require("./configurations/logger");
const connect_db = require("./database_connection/main");
const monitorEvents = require("./utilities/MonitorEvents");

const PORT = config.port;

let server;

const startServer = () => {
  server = app.listen(PORT, () => {
    logger.info(`Event Management Backend Server running`, {
      port: PORT,
      environment: config.nodeEnv,
    });
  });

  if (IS_ANY_MISSED_MODULES) {
    console.log(`
                    
      APPLICATION IS RUNNING BUT ${missed_modules} MODULES MISSED WHICH MIGHT CAUSE AN ERROR IN FUTURE
    =============================================================================================
                    
                    `);
    console.log(`[CRITICAL ERROR] ${missed_modules} missed modules found.`);
  }

  console.log(`See docs at /cok/api/v1/docs/ui`);
};

const gracefulShutdown = () => {
  logger.info("Shutting down gracefully...");
  if (server) {
    server.close(() => {
      logger.info("Server shut down successfully");
      process.exit(0);
    });
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { error: err.message, stack: err.stack });
  gracefulShutdown();
});

logger.info("Starting database connection...");

connect_db()
  .then((response) => {
    if (response.status) {
      logger.info(response.message, {
        host: response.host,
        message: response.message,
        db_name: response.db_name,
      });
      startServer();

      // Start monitoring events in the background every 30 seconds
      setInterval(() => {
        monitorEvents.execute().catch((error) => {
          logger.error("Error in event monitoring", { error: error.message });
        });
      }, 30000);
    } else {
      logger.error(response.message, {
        error: response.error,
        connection_string: response.connection_string,
      });
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error("Database Connection Failed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  console.log(process.env.FRONTEND_URL);