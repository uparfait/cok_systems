require('dotenv').config({quiet: true});
const uuid = require('uuid');

// THE ADDRESS THE SYSTEM SENDS FROM, however EMAIL_FROM is written.
//
// A From header may carry a display name ("IKAZE <a@b>") or not ("<a@b>",
// "a@b"). The deployment writes the bare address, so the system's own name
// is put in front of it here; an EMAIL_FROM that already carries a name is
// left exactly as it is. Without this the mail arrives showing nothing but
// an address.
// How the connection to the mail server starts. Port 465 answers with TLS
// from the first byte; 587 - the city's submission port - answers in the
// clear and STARTTLS upgrades it afterwards. EMAIL_SECURE settles it when
// the port is not a reliable guide, which on this network it has not been:
// the same address has wanted different answers from a workstation and
// from a container. A wrong answer here costs one extra attempt and not
// the mail, because utilities/mail_transport.js tries the other way by
// itself (and remembers which one the server accepted).
const mail_secure = (value, port) => {
  const held = String(value || "").trim().toLowerCase();
  if (held === "true" || held === "1" || held === "yes") return true;
  if (held === "false" || held === "0" || held === "no") return false;
  return Number(port) === 465;
};

const mail_from = (value) => {
  const held = String(value || "").trim();
  // Nothing, or something that is not an address at all: the system's own.
  // Without this last test a stray EMAIL_FROM of "IKAZE" would be turned
  // into "IKAZE <IKAZE>" and the mail server would refuse every message -
  // and refuse it on the FIRST send rather than at startup, which is the
  // hardest kind of fault to find.
  if (!held || held.indexOf("@") < 0) return "IKAZE <coksystems@kigalicity.gov.rw>";
  if (/^[^<]+</.test(held)) return held;
  return `IKAZE ${held.startsWith("<") ? held : `<${held}>`}`;
};
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
  // The City's outgoing mail server: 197.243.27.181 on port 587 with
  // STARTTLS and SMTP authentication (see utilities/email.js).
  // Attendee certificate signing. Leave the issuer blank to accept any issuer,
  // or set it to the exact CN on the GovCA issuing certificate to reject the rest.
  signing: {
    trustedIssuerCommonName: process.env.SIGNING_TRUSTED_ISSUER_CN || '',
    requireNameMatch: (process.env.SIGNING_REQUIRE_NAME_MATCH || 'true') !== 'false',
    // Opt-in strict mode: force matched system users to sign with a digital certificate (off by default)
    requireCertificateForStaff: (process.env.SIGNING_REQUIRE_CERTIFICATE_FOR_STAFF || 'false') === 'true',
  },
  email: {
    host: process.env.EMAIL_HOST || '197.243.27.181',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: mail_secure(process.env.EMAIL_SECURE, parseInt(process.env.EMAIL_PORT, 10) || 587),
    // The name this backend gives the mail server when it says EHLO. Empty
    // means the machine's own name, which in a container is a random id.
    helo: (process.env.EMAIL_HELO_NAME || "").trim(),
    // How long this mail server is allowed to take, for connecting, for
    // greeting and for each answer. The default is the value the main
    // backend was proven to need on this network, where checking a password
    // takes thirty-eight seconds.
    patience: Number(process.env.EMAIL_TIMEOUT_MS) || 655000,
    // No fallback for either: the account password does not belong in a
    // tracked file, and a blank here fails loudly at startup instead of
    // quietly signing in with something stale.
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: mail_from(process.env.EMAIL_FROM),
  },
  log: {
    format: process.env.LOG_FORMAT || 'combined',
  },
};
