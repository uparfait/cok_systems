const express = require("express");
const swaggerUI = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const config = require("./configurations/config");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
// const rateLimit = require("express-rate-limit");
const Router = require("./Router");

const path = require("path");
const app = express();

// Serve uploaded documents


app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors(config.cors));
app.use(express.json({ limit: '250000mb' })); // allows base64 minutes file uploads (files capped at 14MB total client-side) and attendance signatures
app.use(express.urlencoded({ extended: true }));

// const limiter = rateLimit({
//   windowMs: config.rateLimit.windowMs,
//   max: config.rateLimit.maxRequests,
//   message: "Too many requests from this IP",
// });

//app.use(limiter);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "City of Kigali Event Management API",
      version: config.api.version,
      description:
        "API documentation for the City of Kigali Event Management System",
    },
    servers: [
      {
        url: `${config.api.basePath}`,
        description: "Working server",
      },
    ],
  },
  apis: ["./routes/*.js"],
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              status: { type: "number" },
              message: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use(
  `${config.api.basePath}/docs/ui`,
  swaggerUI.serve,
  swaggerUI.setup(swaggerSpec),
);

app.get("/health", (req, res, next) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    __: typeof next === "function",
  });
});

app.use(config.api.basePath, Router);
const UPLOAD_ROUT = config.api.basePath + "/uploads";
app.use(UPLOAD_ROUT, express.static(path.join(__dirname, 'uploads')));

// Serve SPA index.html for attendance form flow (root)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Serve static files (for frontend SPA)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// 404 handler for API routes
app.use((req, res) => {
  // If the request accepts HTML, serve the SPA
  if (req.accepts("html")) {
    return res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
  }
  res.status(404).json({ error: "Route not found" });
});

module.exports = app;
