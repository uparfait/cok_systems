/**
 * Reset Password Controller
 * Step 3: Set new password with signature
 */

const bcrypt = require('bcrypt');
const tokenUtil = require("../../../utilities/token");
const email = require("../../../utilities/email");
const User = require("../../../models/user");

const SALT_ROUNDS = 10;

// Token type for password reset verification signature
const PASSWORD_RESET_VERIFICATION_TYPE = 'password_reset_verification';

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
      return res.status(400).json({
        status: false,
        error: "User ID, signature, new password, and confirm password are required",
        message: null,
      });
    }

    if (newPassword !== confirmPassword) {
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
      return res.status(400).json({
        status: false,
        error: passwordValidation.errors.join(", "),
        message: null,
      });
    }

    // Get user from database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        status: false,
        error: "User not found",
        message: null,
      });
    }

    // Verify signature token (from verified OTP)
    const signatureVerification = tokenUtil.verifyToken(signature, PASSWORD_RESET_VERIFICATION_TYPE);

    if (!signatureVerification.valid) {
      return res.status(400).json({
        status: false,
        error: "Invalid or expired signature",
        message: "Please try requesting a new OTP and verify it again.",
      });
    }

    // Verify the signature belongs to this user
    if (signatureVerification.decoded.userId !== userId.toString()) {
      return res.status(400).json({
        status: false,
        error: "Signature mismatch",
        message: "Signature does not match user. Please verify your OTP again.",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword.trim(), SALT_ROUNDS);

    // Update user's password
    await User.findByIdAndUpdate(userId, {
      $set: {
        password: hashedPassword,
      },
    });

    // Clear any remaining reset tokens from user document
    await User.findByIdAndUpdate(userId, {
      $set: {
        "auth.access_token.token": null,
        "auth.access_token.token_type": null,
        "auth.access_token.expires_at": null,
      },
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
    });
  } catch (error) {
    next(error);
  }
}

module.exports = resetPassword;
