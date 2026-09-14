const { storeAudit } = require('../utilities/auditStore');

/**
 * Response audit for the event service: every response whose status is not
 * a plain success (200/201) becomes one row in the shared "audits"
 * collection (same fields as the other backends), tagged source "events".
 * Mounted once before the routes so the 404 fallback is covered as well.
 * CORS preflights and 304 revalidations are skipped.
 */

const SKIPPED_STATUSES = new Set([200, 201, 304]);

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

function asText(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch (error) { return String(value); }
}

function parseBody(res) {
  const body = res.locals.auditBody;
  if (body === undefined) return null;
  if (typeof body === 'string') {
    const type = String(res.getHeader('content-type') || '');
    if (!type.includes('json')) return null;
    try { return JSON.parse(body); } catch (error) { return null; }
  }
  return typeof body === 'object' ? body : null;
}

// The caller's identity is the JWT the main backend issued; the payload is
// read (not verified - rbac.js already had the main backend vouch for it)
// only to label the audit row with who was calling.
function bearerIdentity(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return {};
  try {
    const payload = JSON.parse(Buffer.from(header.slice(7).split('.')[1], 'base64url').toString('utf8'));
    return { user_id: payload.userId ? String(payload.userId) : null, user_email: payload.email || null, user_name: payload.fullName || null };
  } catch (error) {
    return {};
  }
}

function buildRow(req, res) {
  const body = parseBody(res) || {};
  const identity = bearerIdentity(req);
  const endpoint = req.originalUrl || req.url || '';
  return {
    time: new Date(),
    status: res.statusCode,
    method: req.method,
    user_id: identity.user_id || null,
    user_email: identity.user_email || (req.eventAccess && req.eventAccess.email) || null,
    user_name: identity.user_name || null,
    description: req.auditDescription || `${req.method} ${endpoint} answered ${res.statusCode}`,
    message: asText(body.message),
    error: asText(body.error) || asText(body.errors) || null,
    endpoint,
    ip_address: clientIp(req),
    source: 'events',
  };
}

function auditResponse(req, res, next) {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function (data) {
    res.locals.auditBody = data;
    return originalJson(data);
  };
  res.send = function (data) {
    if (res.locals.auditBody === undefined) res.locals.auditBody = data;
    return originalSend(data);
  };

  res.on('finish', () => {
    if (req.method === 'OPTIONS' || SKIPPED_STATUSES.has(res.statusCode)) return;
    storeAudit(buildRow(req, res));
  });

  next();
}

module.exports = auditResponse;
