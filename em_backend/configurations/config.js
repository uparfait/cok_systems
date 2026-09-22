require('dotenv').config({quiet: true});
const uuid = require('uuid');

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 2027,
  logLevel: process.env.LOG_LEVEL || 'info',
  
  database: {
    url: process.env.DATABASE_URL2 || 'mongodb://localhost:27017/COK_EVENT_MNG',
    name: process.env.DATABASE_NAME2 || 'COK_EVENT_MNG',
  },
  // The main system's database on the same cluster - audit rows of every
  // backend are stored in its shared "audits" collection.
  cokDbName: process.env.COK_DB_NAME || 'cok',
  cors: {
    // One origin, several separated by commas, or * for any.
    origin: process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim() !== '*'
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean)
      : process.env.CORS_ORIGIN || '*',
    methods: process.env.CORS_METHODS || 'GET,POST,PUT,DELETE',
    allowedHeaders: process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization',
    credentials: process.env.CORS_CREDENTIALS || 'true',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },
  api: {
    version: process.env.API_VERSION || 'v1',
    basePath: process.env.API_BASE_PATH || '/cok/api/v1',
  },
  // Local hosts never serve TLS, so an accidental https:// in FRONTEND_URL is coerced to http://
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .replace(/\/$/, '')
    .replace(/^https:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/i, 'http://$1'),
  // Must match the main backend's JWT_SECRET: tokens issued by its login flow
  // are verified here directly (middlewares/authenticate.js). The default
  // mirrors the main backend's own development default.
  jwt: {
    secret: process.env.JWT_SECRET || 'cok-jwt-secret-2026',
  },
  email: {
    host: process.env.EMAIL_HOST || 'mail.kigalicity.gov.rw',
    port: parseInt(process.env.EMAIL_PORT, 10) || 25,
    user: process.env.EMAIL_USER || 'coksystems@kigalicity.gov.rw',
    pass: process.env.EMAIL_PASS || 'CTown@2025!&',
    from: process.env.EMAIL_FROM || '"IKAZE" <coksystems@kigalicity.gov.rw>',
  },
  log: {
    format: process.env.LOG_FORMAT || 'combined',
  },
};
