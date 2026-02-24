/**
 * Reset Password Controller
 * Step 3: Set new password with temp token
 */

const bcrypt = require('bcrypt');
const tokenUtil = require("../../../utilities/token");
const email = require("../../../utilities/email");
const User = require("../../../models/user");

const SALT_ROUNDS = 10;

// Expected token type for password reset temp token
const EXPECTED_TOKEN_TYPE = 'password_reset_temp';

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
    const { userId, tempToken, newPassword } = req.body;

    if (!userId || !tempToken || !newPassword) {
      return res.status(400).json({
        status: false,
        error: "User ID, temp token, and new password are required",
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
      return res.status(400).json({
        status: false,
        error: "User not found",
        message: null,
      });
    }

    // Verify temp token from database
    const storedToken = user.auth?.access_token?.token;
    const tokenExpiry = user.auth?.access_token?.expires_at;
    const tokenType = user.auth?.access_token?.token_type;

    // Check token type stored in database
    if (tokenType !== EXPECTED_TOKEN_TYPE) {
      return res.status(400).json({
        status: false,
        error: "Invalid token type",
        message: `Expected token type '${EXPECTED_TOKEN_TYPE}', but found '${tokenType || 'none'}'. Please start the password reset process again.`
      });
    }

    if (!storedToken) {
      return res.status(400).json({
        status: false,
        error: "Invalid or expired reset token",
        message: "Please start the password reset process again."
      });
    }

    // Check if token has expired
    if (tokenExpiry && new Date() > new Date(tokenExpiry)) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          "auth.access_token.token": null,
          "auth.access_token.token_type": null,
          "auth.access_token.expires_at": null,
        },
      });

      return res.status(400).json({
        status: false,
        error: "Reset token has expired",
        message: "Please start the password reset process again."
      });
    }

    // Verify the temp token
    const hashMatch = await tokenUtil.compareToken(tempToken, storedToken);

    if (!hashMatch) {
      return res.status(400).json({
        status: false,
        error: "Invalid or expired reset token",
        message: "Please start the password reset process again."
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update user's password
    await User.findByIdAndUpdate(userId, {
      $set: {
        password: hashedPassword,
      },
    });

    // Clear the reset token from user document
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
