/**
 * Toggle 2FA Controller
 * Admin endpoint to enable or disable 2FA for a user
 */

const User = require("../../../models/user");
const { logAuditEvent } = require("../../../middlewares/audit");

async function toggle2FA(req, res, next) {
  try {
    const { userId, disable } = req.body;

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

    const isDisabling = disable === true || disable === "true";
    const newStatus = !isDisabling;

    await User.findByIdAndUpdate(userId, {
      $set: {
        is_2FA_disabled: isDisabling,
        "twofa_verification.attempts": 0,
        "twofa_verification.last_attempt": null,
        "twofa_verification.locked_until": null
      },
    });

    await logAuditEvent('UPDATE', `2FA ${isDisabling ? 'disabled' : 'enabled'} for user: ${user.email}`, req, {
      resource: 'users',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: {
        email: user.email,
        two_fa_disabled: isDisabling
      }
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: `2FA ${isDisabling ? 'disabled' : 'enabled'} successfully for user ${user.email}`,
      data: {
        userId: user._id,
        email: user.email,
        is2FADisabled: isDisabling
      },
    });

  } catch (error) {
    next(error);
  }
}

module.exports = toggle2FA;
