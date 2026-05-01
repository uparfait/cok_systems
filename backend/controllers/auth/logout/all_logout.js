/**
 * Logout All Devices Controller
 * Logout from all devices (invalidate all tokens for user)
 */

const User = require("../../../models/user");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

async function logoutAll(req, res, next) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        status: false,
        error: "User ID is required",
        message: null,
      });
    }

    // Get user info before logout for audit logging
    const user = await User.findById(userId).select('email full_name');

    // Increment token version to invalidate all tokens for user
    await User.findByIdAndUpdate(userId, {
      $inc: { "auth.token_version": 1 },
      $set: {
        "auth.access_token": null
      }
    });

    // Log logout from all devices
    await logAuditEvent('LOGOUT', `User logged out from all devices: ${user?.email || 'unknown'}`, req, {
      resource: 'auth',
      resource_id: userId,
      status_code: 200,
      metadata: {
        email: user?.email,
        logout_type: 'all_devices'
      }
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: "Logged out from all devices",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = logoutAll;
