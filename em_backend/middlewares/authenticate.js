const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../configurations/config');
const { cokCollection } = require('../utilities/cokDb');

/**
 * Verifies the Bearer token issued by the main backend's login flow (same
 * JWT_SECRET) and loads the matching account from the main system's users
 * collection, so the role and lock state are always the current ones.
 * Mirrors dc_backend/middlewares/authenticate.js. Resolves to
 * { ok: true, user } or { ok: false, status, body }; never throws.
 */

function refusal(status, message, error, gotoLogin) {
  return { ok: false, status, body: { success: false, type: 'warning', goto_login: gotoLogin !== false, message, error } };
}

function extractToken(authHeader) {
  if (!authHeader) return null;
  const parts = String(authHeader).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

async function authenticateBearer(authHeader) {
  const token = extractToken(authHeader);
  if (!token) return refusal(401, 'Your are required to login', 'Authorization token is missing or malformed');

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return refusal(401, 'Your are required to login', error.message);
  }

  if (!decoded || !decoded.userId || !mongoose.Types.ObjectId.isValid(String(decoded.userId))) {
    return refusal(401, 'Your are required to login', 'Token carries no valid user');
  }

  let user;
  try {
    const users = await cokCollection('users');
    user = await users.findOne({ _id: new mongoose.Types.ObjectId(String(decoded.userId)) });
  } catch (error) {
    console.error('[AUTH] user lookup failed:', error.message);
    return refusal(500, 'Authentication failed', error.message, false);
  }

  if (!user) return refusal(401, "Sorry we can't find your account yet!", 'User associated with token no longer exists');
  if (!user.is_account_activated) return refusal(403, 'Account not activated', 'Please activate your account first', false);
  if (user.access_control && user.access_control.is_locked) {
    return refusal(403, 'Account is locked', user.access_control.reason || 'Your account has been locked. Please contact administrator.', false);
  }

  return {
    ok: true,
    user: {
      user_id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: (user.roles && user.roles.role_name) || '',
      permissions: (user.roles && user.roles.permissions) || [],
    },
  };
}

module.exports = { authenticateBearer, extractToken };
