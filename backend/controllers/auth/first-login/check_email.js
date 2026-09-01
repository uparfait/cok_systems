/**
 * Check Email Controller
 * Step 1: Check if email exists and account is not activated
 */

const User = require("../../../models/user");
const tokenUtil = require("../../../utilities/token");
// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";

// Token type for OTP verification signature
const OTP_VERIFICATION_TYPE = "otp_verification";

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
        message:
          "No account found with this email. Please contact your administrator.",
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
          reason: user.access_control?.reason,
        },
      });
    }

    // Check if account is already activated
    if (user.is_account_activated) {
      return res.status(400).json({
        status: false,
        error: "Account already activated",
        message:
          "This account is already active. Please use the regular login.",
        data: {
          alreadyActivated: true,
        },
      });
    }

    // Check if 2FA is disabled - generate signature for direct activation or is alread-set
    let signature = null;

    const isAlreadySet2FA = !!user.twofa_secret;

    if (!!user.is_2FA_disabled || isAlreadySet2FA) {
      signature = tokenUtil.generateToken(
        { userId: user._id.toString() },
        "30m",
        OTP_VERIFICATION_TYPE,
      );
    }

    return res.status(200).json({
      status: true,
      error: null,
      message: "Account found. You can proceed with activation!",
      data: {
        userId: user._id,
        email: normalizedEmail,
        canActivate: true,
        is2FADisabled: !!user.is_2FA_disabled || isAlreadySet2FA,
        signature,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = checkEmail;
