/**
 * Check Email Controller
 * Step 1: Check if email exists and account is not activated
 */

const User = require("../../../models/user");
// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";

async function checkEmail(req, res, next) {
  try {
    const { email: userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({
        status: false,
        error: "Email is required",
        message: null,
      });
    }

    const normalizedEmail = userEmail.trim().toLowerCase();

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        status: false,
        error: "Account not found",
        message: "No account found with this email. Please contact your administrator.",
      });
    }

    // Check if account is locked
    if (user.access_control?.is_locked) {
      return res.status(403).json({
        status: false,
        error: "Account is locked",
        message: LOCK_MESSAGE,
        data: {
          isLocked: true,
          reason: user.access_control?.reason
        }
      });
    }

    // Check if account is already activated
    if (user.is_account_activated) {
      return res.status(400).json({
        status: false,
        error: "Account already activated",
        message: "This account is already active. Please use the regular login.",
        data: {
          alreadyActivated: true
        }
      });
    }

    return res.status(200).json({
      status: true,
      error: null,
      message: "Account found. You can proceed with activation.",
      data: {
        userId: user._id,
        email: normalizedEmail,
        canActivate: true
      },
    });

  } catch (error) {
    next(error);
  }
}

module.exports = checkEmail;
