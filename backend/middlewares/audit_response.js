/**
 * Response audit: watches every response the app sends and stores an audit
 * row for each one whose status is not a plain success (200/201). Mounted
 * once, before the routes, so it covers controllers, the 404 handler and
 * the global error handler alike. CORS preflights and 304 revalidations
 * are the only responses skipped - neither is an action anyone took.
 *
 * A controller can enrich the row through req.audit_description (set by
 * logAuditEvent in middlewares/audit.js) and req.audit_error (set by the
 * auditError handler); otherwise the description is derived from the
 * request and the message/error come straight out of the JSON body sent
 * to the user.
 */

const Audit = require('../models/audit');

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
    const body = res.locals.audit_body;
    if (body === undefined) return null;
    if (typeof body === 'string') {
        const type = String(res.getHeader('content-type') || '');
        if (!type.includes('json')) return null;
        try { return JSON.parse(body); } catch (error) { return null; }
    }
    return typeof body === 'object' ? body : null;
}

function buildRow(req, res) {
    const body = parseBody(res) || {};
    const user = req.user || {};
    const endpoint = req.originalUrl || req.url || '';
    const status = res.statusCode;
    const description = req.audit_description || `${req.method} ${endpoint} answered ${status}`;
    return {
        time: new Date(),
        status,
        method: req.method,
        user_id: user.userId ? String(user.userId) : user._id ? String(user._id) : null,
        user_email: user.email || null,
        user_name: user.full_name || user.fullName || user.name || null,
        description,
        message: asText(body.message),
        error: asText(body.error) || asText(body.errors) || req.audit_error || null,
        endpoint,
        ip_address: clientIp(req),
        source: 'backend',
    };
}

function auditResponse(req, res, next) {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (data) {
        res.locals.audit_body = data;
        return originalJson(data);
    };
    res.send = function (data) {
        if (res.locals.audit_body === undefined) res.locals.audit_body = data;
        return originalSend(data);
    };

    res.on('finish', () => {
        if (req.method === 'OPTIONS' || SKIPPED_STATUSES.has(res.statusCode)) return;
        Audit.create(buildRow(req, res)).catch((error) => {
            console.error('[AUDIT] failed to store audit row:', error.message);
        });
    });

    next();
}

module.exports = auditResponse;
