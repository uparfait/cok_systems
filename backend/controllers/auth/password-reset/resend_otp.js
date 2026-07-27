/**
 * Resend OTP Controller
 * Resend OTP if previous one expired
 */

const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";

async function resendOTP(req, res, next) {
  try {
    const { userId, email: userEmail } = req.body;

    if (!userId || !userEmail) {
      return res.status(400).json({
        status: false,
        error: "User ID and email are required",
        message: null,
      });
    }

    // Check if user exists and is not locked
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        error: "User not found",
        message: null,
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

    // check if account is activated
    if (!user.is_account_activated) {
      return res.status(403).json({
        status: false,
        error: "Account not activated",
        message: "Account is not activated. Please contact your administrator.",
        data: {
          isActivated: false
        }
       });
     }

    // Generate new 5-digit OTP
    const { otp: otpCode } = otp.generateOTPWithExpiry();

    // Hash and store in database
    const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());
    const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

    if (!user.auth || !user.auth?.access_token?.token_type) {
      user.auth = {};
       user.auth.access_token = {}
       user.auth.access_token.token_type = "password_reset_otp";
       user.auth.access_token.token = hashedOTP;
       user.auth.access_token.expires_at = otpExpiry;
      await user.save();
    } else {
      // Store OTP in database (instead of Redis)
      await User.findByIdAndUpdate(user._id, {
        $set: {
          auth: {
            access_token: {
              token_type: "password_reset_otp",
              token: hashedOTP,
              expires_at: otpExpiry
            }
          }
        }
      });
    }
    

    // Send new OTP via email
    await email.sendOTPEmail(userEmail, otpCode, "password_reset");

    return res.status(200).json({
      status: true,
      error: null,
      message: "New OTP sent to your email",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = resendOTP;
