/**
 * Reset 2FA Controller
 * Admin endpoint to reset 2FA for a user (removes 2FA secret and requires re-setup)
 */

const User = require("../../../models/user");
const { logAuditEvent } = require("../../../middlewares/audit");

async function reset2FA(req, res, next) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        status: false,
        error: "User ID is required",
        message: null,
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        error: "User not found",
        message: null,
      });
    }

    await User.findByIdAndUpdate(userId, {
      $set: {
        twofa_secret: null,
        auth: {
          access_token: {
            token: null,
            token_type: null,
            expires_at: null
          }
        }
      }
    });

    await logAuditEvent('UPDATE', `2FA reset for user: ${user.email}`, req, {
      resource: 'users',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: {
        email: user.email,
        two_fa_reset: true
      }
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: `2FA has been reset for ${user.email}. The user will need to set up 2FA again on next login.`,
      data: {
        userId: user._id,
        email: user.email
      },
    });

  } catch (error) {
    next(error);
  }
}

module.exports = reset2FA;
