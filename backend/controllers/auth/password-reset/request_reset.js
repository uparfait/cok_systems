/**
 * Password Reset Request Controller
 * Step 1: Request password reset - send OTP to email
 */

const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";

async function requestReset(req, res, next) {
  try {
    const { email: userEmail } = req.body;

    if (!userEmail) {
      await logAuditEvent('SYSTEM', 'Password reset request failed: Email required', req, {
        resource: 'auth',
        status_code: 400,
        error_message: 'Email parameter missing'
      });

      return res.status(400).json({
        status: false,
        error: "Email is required",
        type: 'warning',
        message: "Email is required",
      });
    }

    // Check if user exists in database
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      // Log failed attempt for non-existent user
      await logAuditEvent('SYSTEM', `Password reset request for non-existent user: ${userEmail}`, req, {
        resource: 'auth',
        status_code: 404,
        metadata: { email: userEmail }
      });

      // Don't reveal if email exists or not
      return res.status(404).json({
        status: false,
        type: 'warning',
        error: `User with this email ${userEmail} does not exist. Please check and try again.`,
        message: `User with this email ${userEmail} does not exist. Please check and try again.`,
      });
    }

    // Check if account is locked
    if (user.access_control?.is_locked) {
      await logAuditEvent('SYSTEM', `Password reset attempt on locked account: ${userEmail}`, req, {
        resource: 'auth',
        resource_id: user._id.toString(),
        status_code: 403,
        metadata: {
          email: userEmail,
          reason: user.access_control?.reason
        }
      });

      return res.status(403).json({
        status: false,
        error: "Account is locked",
        type: 'warning',
        message: LOCK_MESSAGE,
        data: {
          isLocked: true,
          reason: user.access_control?.reason
        }
      });
    }

    // Check if account is activated
    if (!user.is_account_activated) {
      await logAuditEvent('SYSTEM', `Password reset attempt on inactive account: ${userEmail}`, req, {
        resource: 'auth',
        resource_id: user._id.toString(),
        status_code: 403,
        metadata: { email: userEmail }
      });

      return res.status(403).json({
        status: false,
        error: "Account not activated",
        type: 'warning',
        message: "Account is not activated. Please contact your administrator.",
        data: {
          isActivated: false
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
          "auth.access_token.token_type": "password_reset_otp",
          "auth.access_token.token": hashedOTP,
          "auth.access_token.expires_at": otpExpiry,
        },
      });
    }

    // Send OTP via email
    await email.sendOTPEmail(userEmail, otpCode, "password_reset");

    // Log successful password reset request
    await logAuditEvent('SYSTEM', `Password reset OTP sent to: ${userEmail}`, req, {
      resource: 'auth',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: {
        email: userEmail,
        purpose: 'password_reset'
      }
    });

    const updatedUser = await User.findOne({ email: userEmail });
    console.log("Updated user:", updatedUser);

    return res.status(200).json({
      status: true,
      error: null,
      type: 'success',
      message: "OTP sent to your email for password reset",
      data: {
        userId: user._id,
      },
    });
  } catch (error) {
    // Log system error
    await logAuditEvent('ERROR', `Password reset request failed: ${error.message}`, req, {
      resource: 'auth',
      status_code: 500,
      error_message: error.message,
      metadata: {
        stack: error.stack,
        email: req.body?.email
      }
    });

    next(error);
  }
}

module.exports = requestReset;
