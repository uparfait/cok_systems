/**
 * Password Reset Request Controller
 * Step 1: Request password reset - send OTP to email
 */

const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";

async function requestReset(req, res, next) {
  try {
    const { email: userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({
        status: false,
        error: "Email is required",
        message: null,
      });
    }

    // Check if user exists in database
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      // Don't reveal if email exists or not
      return res.status(200).json({
        status: true,
        error: null,
        message: `User with this email ${userEmail} does not exist. Please check and try again.`,
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

    // Generate 5-digit OTP
    const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();

    // Hash the OTP for database storage
    const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());

    // Calculate expiry time
    const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

    // Check if user has auth attribute, if not create it and save data accordingly
    if (!user.auth) {
      user.auth = {};
      user.auth.access_token = {}
      user.auth.access_token.token_type = "password_reset_otp";
      user.auth.access_token.token = hashedOTP;
      await user.save();
    } else {
      // Store OTP in database (instead of Redis)
      await User.findByIdAndUpdate(user._id, {
        $set: {
          "auth.access_token.token_type": "password_reset_otp",
          "auth.access_token.token": hashedOTP,
          "auth.access_token.expires_at": otpExpiry,
        },
      });
    }

    // Send OTP via email
    await email.sendOTPEmail(userEmail, otpCode, "password_reset");

    const updatedUser = await User.findOne({ email: userEmail });
    console.log("Updated user:", updatedUser);

    return res.status(200).json({
      status: true,
      error: null,
      message: "OTP sent to your email for password reset",
      data: {
        userId: user._id,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = requestReset;
