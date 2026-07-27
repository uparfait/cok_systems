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
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
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
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  jwt: {
    secret: process.env.JWT_SECRET || uuid.v4(),
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
