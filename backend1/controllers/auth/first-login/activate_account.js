/**
 * Activate Account Controller
 * Step 3: Verify OTP and create password
 */

const bcrypt = require('bcrypt');
const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

const SALT_ROUNDS = 10;

// Expected token type for first login OTP
const EXPECTED_TOKEN_TYPE = 'first_login_otp';
// Token type for OTP verification signature
const OTP_VERIFICATION_TYPE = 'otp_verification';

// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";

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

async function activateAccount(req, res, next) {
  
  try {
    const { userId, signature, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!userId || !signature) {
      return res.status(400).json({
        status: false,
        error: "User ID and signature are required",
        message: null,
      });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        status: false,
        error: "New password and confirmation are required",
        message: null,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: false,
        error: "Passwords do not match",
        message: null,
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

    // Check if account is already activated
    if (user.is_account_activated) {
      return res.status(400).json({
        status: false,
        error: "Account already activated",
        message: "This account is already active.",
      });
    }

    // Verify signature token (from verified OTP)
    const signatureVerification = tokenUtil.verifyToken(signature, OTP_VERIFICATION_TYPE);

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
        message: "We  have found a signature but it does not match try again later.",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update user with password and mark as activated
    await User.findByIdAndUpdate(userId, {
      $set: {
        password: hashedPassword,
        is_account_activated: true,
        "auth.access_token.token": null,
        "auth.access_token.token_type": null,
        "auth.access_token.expires_at": null
      },
    });

    // Send confirmation email
    try {
      await email.sendAccountActivatedEmail(user.email, user.full_name);
    } catch (emailError) {
      // Log email error but don't fail the activation
      console.error("Failed to send activation confirmation email:", emailError);
    }

    return res.status(200).json({
      status: true,
      error: null,
      message: "Account activated successfully! You can now login with your email and password.",
    });

  } catch (error) {
    next(error);
  }
}

module.exports = activateAccount;
