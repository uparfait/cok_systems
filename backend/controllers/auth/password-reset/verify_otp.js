/**
 * Verify OTP Controller
 * Step 2: Verify OTP and allow password change
 */

const otp = require("../../../utilities/otp");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

// Expected token type for password reset OTP
const EXPECTED_TOKEN_TYPE = 'password_reset_otp';
// Token type for password reset verification signature
const PASSWORD_RESET_VERIFICATION_TYPE = 'password_reset_verification';

async function verifyOTP(req, res, next) {
  try {
    const { userId, otp: inputOTP } = req.body;

    if (!userId || !inputOTP) {
      await logAuditEvent('SYSTEM', 'Password reset OTP verification failed: Missing parameters', req, {
        resource: 'auth',
        status_code: 400,
        metadata: { hasUserId: !!userId, hasOTP: !!inputOTP }
      });

      return res.status(400).json({
        status: false,
        error: "User ID and OTP are required",
        message: null,
      });
    }

    // Get user from database
    const user = await User.findById(userId);

    if (!user) {
      await logAuditEvent('SYSTEM', `Password reset OTP verification failed: User not found (${userId})`, req, {
        resource: 'auth',
        status_code: 400,
        metadata: { userId }
      });

      return res.status(400).json({
        status: false,
        error: "User not found",
        message: null,
      });
    }

    // Check token type stored in database
    const storedTokenType = user.auth?.access_token?.token_type;

    if (storedTokenType !== EXPECTED_TOKEN_TYPE) {
      await logAuditEvent('SYSTEM', `Password reset OTP verification failed: Invalid token type for ${user.email}`, req, {
        resource: 'auth',
        resource_id: user._id.toString(),
        status_code: 400,
        metadata: {
          email: user.email,
          expectedType: EXPECTED_TOKEN_TYPE,
          actualType: storedTokenType
        }
      });

      return res.status(400).json({
        status: false,
        error: "Invalid token type",
        message: `Invalid token type`
      });
    }

    // Check if OTP exists and not expired - use access_token.token for OTP storage
    const storedOTP = user.auth?.access_token?.token;
    const otpExpiry = user.auth?.access_token?.expires_at;

    if (!storedOTP) {
      await logAuditEvent('SYSTEM', `Password reset OTP verification failed: No OTP found for ${user.email}`, req, {
        resource: 'auth',
        resource_id: user._id.toString(),
        status_code: 400,
        metadata: { email: user.email }
      });

      return res.status(400).json({
        status: false,
        error: "OTP expired or not found",
        message: "Please request a new OTP."
      });
    }

    // Check if OTP has expired
    if (otpExpiry && new Date() > new Date(otpExpiry)) {
      // Clear expired OTP
      await User.findByIdAndUpdate(userId, {
        $set: {
          auth: {
            access_token: {
              token: null,
              token_type: null,
              expires_at: null
            }
          }
        }
      });

      await logAuditEvent('SYSTEM', `Password reset OTP expired for ${user.email}`, req, {
        resource: 'auth',
        resource_id: user._id.toString(),
        status_code: 400,
        metadata: {
          email: user.email,
          expiryTime: otpExpiry
        }
      });

      return res.status(400).json({
        status: false,
        error: "OTP has expired",
        message: "Please request a new OTP."
      });
    }

    // Validate OTP (compare hashed values)
    const hashMatch = await tokenUtil.compareToken(inputOTP.toString(), storedOTP);

    if (!hashMatch) {
      await logAuditEvent('SYSTEM', `Password reset OTP verification failed: Invalid OTP for ${user.email}`, req, {
        resource: 'auth',
        resource_id: user._id.toString(),
        status_code: 400,
        metadata: { email: user.email }
      });

      return res.status(400).json({
        status: false,
        error: "Invalid OTP",
        message: "The OTP you entered is incorrect."
      });
    }

    // OTP valid - clear it from database (one-time use)
    await User.findByIdAndUpdate(userId, {
      $set: {
        auth: {
          access_token: {
            token: null,
            token_type: null,
            expires_at: null
          }
        }
      }
    });

    // Generate signature token for password reset (expires in 30 minutes)
    const signature = tokenUtil.generateToken({ userId: user._id.toString() }, '30m', PASSWORD_RESET_VERIFICATION_TYPE);

    // Log successful OTP verification
    await logAuditEvent('SYSTEM', `Password reset OTP verified for ${user.email}`, req, {
      resource: 'auth',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: { email: user.email }
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: "OTP verified. You can now reset your password.",
      data: {
        signature: signature,
      },
    });
  } catch (error) {
    // Log system error
    await logAuditEvent('ERROR', `Password reset OTP verification system error: ${error.message}`, req, {
      resource: 'auth',
      status_code: 500,
      error_message: error.message,
      metadata: {
        stack: error.stack,
        userId: req.body?.userId
      }
    });

    next(error);
  }
}

module.exports = verifyOTP;
