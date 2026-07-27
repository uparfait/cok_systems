/**
 * Reset Password Controller
 * Step 3: Set new password with signature and return TOTP setup
 */

const bcrypt = require('bcrypt');
const tokenUtil = require("../../../utilities/token");
const totp = require("../../../utilities/totp");
const email = require("../../../utilities/email");
const User = require("../../../models/user");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

const SALT_ROUNDS = 10;

// Token type for password reset verification signature
const PASSWORD_RESET_VERIFICATION_TYPE = 'password_reset_verification';

// TOTP setup TTL
const TOTP_SETUP_TTL_MINUTES = 15;

// Password validation
const passwordValidator = (password) => {
  const errors = [];
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one digit");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
};

async function resetPassword(req, res, next) {
  try {
    const { userId, signature, newPassword, confirmPassword } = req.body;

    if (!userId || !signature || !newPassword || !confirmPassword) {
      await logAuditEvent('SYSTEM', 'Password reset failed: Missing required parameters', req, {
        resource: 'auth',
        status_code: 400,
        metadata: {
          hasUserId: !!userId,
          hasSignature: !!signature,
          hasNewPassword: !!newPassword,
          hasConfirmPassword: !!confirmPassword
        }
      });

      return res.status(400).json({
        status: false,
        error: "User ID, signature, new password, and confirm password are required",
        message: null,
      });
    }

    if (newPassword !== confirmPassword) {
      await logAuditEvent('SYSTEM', 'Password reset failed: Password mismatch', req, {
        resource: 'auth',
        status_code: 400,
        metadata: { userId }
      });

      return res.status(400).json({
        status: false,
        error: "New password and confirm password do not match",
        message: null,
      });
    }

    async function resetLoginAttempts(userId) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          "access_control.last_login_attempt": 0
        }
      });
    }

    // Validate password policy
    const passwordValidation = passwordValidator(newPassword);
    if (!passwordValidation.valid) {
      await logAuditEvent('SYSTEM', `Password reset failed: Invalid password policy for user ${userId}`, req, {
        resource: 'auth',
        status_code: 400,
        metadata: {
          userId,
          errors: passwordValidation.errors
        }
      });

      return res.status(400).json({
        status: false,
        error: passwordValidation.errors.join(", "),
        message: null,
      });
    }

    // Get user from database
    const user = await User.findById(userId);

    if (!user) {
      await logAuditEvent('SYSTEM', `Password reset failed: User not found (${userId})`, req, {
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

    // Verify signature token (from verified OTP)
    const signatureVerification = tokenUtil.verifyToken(signature, PASSWORD_RESET_VERIFICATION_TYPE);

    if (!signatureVerification.valid) {
      await logAuditEvent('SYSTEM', `Password reset failed: Invalid signature for ${user.email}`, req, {
        resource: 'auth',
        resource_id: user._id.toString(),
        status_code: 400,
        metadata: { email: user.email }
      });

      return res.status(400).json({
        status: false,
        error: "Invalid or expired signature",
        message: "Please try requesting a new OTP and verify it again.",
      });
    }

    // Verify the signature belongs to this user
    if (signatureVerification.decoded.userId !== userId.toString()) {
      await logAuditEvent('SYSTEM', `Password reset failed: Signature mismatch for ${user.email}`, req, {
        resource: 'auth',
        resource_id: user._id.toString(),
        status_code: 400,
        metadata: {
          email: user.email,
          expectedUserId: userId,
          signatureUserId: signatureVerification.decoded.userId
        }
      });

      return res.status(400).json({
        status: false,
        error: "Signature mismatch",
        message: "Signature does not match user. Please verify your OTP again.",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword.trim(), SALT_ROUNDS);

    // Generate new TOTP secret for 2FA setup (stored in twofa_setup, NOT twofa_secret)
    const { secret, otpauthUrl } = totp.generateTOTPSecret(user.email);
    const qrCodeDataUrl = await totp.generateQRCode(otpauthUrl);
    const setupExpiry = totp.createTOTPSetupExpiry(TOTP_SETUP_TTL_MINUTES);

    // Update user's password and set up TOTP in twofa_setup (pending verification)
    await User.findByIdAndUpdate(userId, {
      $set: {
        password: hashedPassword,
        twofa_setup: {
          secret: secret,
          qr_code: qrCodeDataUrl,
          otpauth_url: otpauthUrl,
          created_at: new Date(),
          expires_at: setupExpiry,
          verified: false
        },
        "twofa_verification.attempts": 0,
        "twofa_verification.last_attempt": null,
        "twofa_verification.locked_until": null,
        auth: {
          access_token: {
            token: null,
            token_type: null,
            expires_at: null
          }
        }
      }
    });

    // Log successful password reset
    await logAuditEvent('UPDATE', `Password successfully reset for ${user.email}`, req, {
      resource: 'users',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: { email: user.email }
    });

    // Send confirmation email
    try {
      await email.sendPasswordChangedEmail(user.email, user.full_name);
    } catch (emailError) {
      console.error("Failed to send password change confirmation email:", emailError);
    }

    // Reset login attempts for the user
    await resetLoginAttempts(userId);

    return res.status(200).json({
      status: true,
      error: null,
      message: "Password reset successfully",
      data: {
        requiresTOTPSetup: true,
        secret: secret,
        qrCode: qrCodeDataUrl,
        otpauthUrl: otpauthUrl,
        expiresAt: setupExpiry
      },
    });
  } catch (error) {
    // Log system error
    await logAuditEvent('ERROR', `Password reset system error: ${error.message}`, req, {
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

module.exports = resetPassword;
