/**
 * Logout All Devices Controller
 * Logout from all devices (invalidate all tokens for user)
 */

const User = require("../../../models/user");

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

    // Increment token version to invalidate all tokens for user
    await User.findByIdAndUpdate(userId, {
      $inc: { "auth.token_version": 1 },
      $set: {
        "auth.access_token": null
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
