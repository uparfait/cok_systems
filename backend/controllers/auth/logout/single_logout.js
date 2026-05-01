/**
 * Single Logout Controller
 * Invalidate user's current JWT token
 */

const jwt = require("../../../utilities/jwt");
const User = require("../../../models/user");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

async function logout(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(200).json({
        status: true,
        error: null,
        message: "Logged out successfully",
      });
    }

    // Extract token
    const token = jwt.extractToken(authHeader);

    let userId = null;
    let userEmail = null;

    if (token) {
      // Decode token to get userId
      const decoded = jwt.decodeToken(token);

      if (decoded && decoded.userId) {
        userId = decoded.userId;
        userEmail = decoded.email;

        // Increment token version to invalidate all existing tokens
        await User.findByIdAndUpdate(decoded.userId, {
          $inc: { "auth.token_version": 1 },
          $set: {
            "auth.access_token": null
          }
        });

        // Log logout event
        await logAuditEvent('LOGOUT', `User logged out: ${userEmail || 'unknown'}`, req, {
          resource: 'auth',
          resource_id: userId,
          status_code: 200,
          metadata: {
            email: userEmail,
            logout_type: 'single'
          }
        });
      }
    }

    return res.status(200).json({
      status: true,
      error: null,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = logout;
