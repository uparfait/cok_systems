/**
 * Send OTP Controller
 * Step 2: Send OTP to user's email for verification
 */

const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";

async function sendOTP(req, res, next) {
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
        message: "No account found with this email.",
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
      });
    }

    // Generate 5-digit OTP
    const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();

    // Hash the OTP for database storage
    const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());

    // Calculate expiry time
    const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

    await User.findByIdAndUpdate(user._id, {
      $set: {
        "auth.access_token.token_type": "first_login_otp",
        "auth.access_token.token": hashedOTP,
      },
    });

    // Send OTP email
    await email.sendOTPEmail(normalizedEmail, otpCode, "first_login");

    return res.status(200).json({
      status: true,
      error: null,
      message: "OTP sent to your email. Please verify to activate your account.",
      data: {
        userId: user._id,
        email: normalizedEmail,
      },
    });

  } catch (error) {
    next(error);
  }
}

module.exports = sendOTP;
