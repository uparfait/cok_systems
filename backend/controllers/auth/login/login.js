/**
 * Login Controller
 * Handles user login - verifies credentials, manages login attempts, and sends OTP
 */

const jwt = require("../../../utilities/jwt");
const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const bcrypt = require('bcrypt');
const User = require("../../../models/user");

// Configuration for login attempts
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MESSAGE = "Account locked due to too many failed login attempts. Please contact administrator or reset password.";

async function login(req, res, next) {
  try {
    let { email: userEmail = null, password = null } = req.body || {};

    userEmail = userEmail ? userEmail.trim().toLowerCase() : null;

    // Validate input
    if (!userEmail || !password) {
      return res.status(400).json({
        status: false,
        error: "Email and password are required",
        message: null,
      });
    }

    // Check user in database
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(401).json({
        status: false,
        error: "Invalid credentials",
        message: null,
      });
    }

    // Initialize access_control if not exists
    if (!user.access_control) {
      user.access_control = {
        is_locked: false,
        reason: null,
        last_login_attempt: 0
      };
      await user.save();
    }

    // Check if account is locked
    if (user.access_control.is_locked) {
      return res.status(403).json({
        status: false,
        error: "Account is locked",
        message: LOCK_MESSAGE,
        data: {
          isLocked: true,
          reason: user.access_control.reason
        }
      });
    }

    // Check if account is activated (for first-time login users)
    if (!user.is_account_activated) {
      return res.status(403).json({
        status: false,
        error: "Account not activated",
        message: "Please use First-Time Login to activate your account",
        data: {
          requiresActivation: true,
          email: userEmail
        }
      });
    }

    // Verify password before sending OTP
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      // Handle failed password attempt
      const attempts = (user.access_control.last_login_attempt || 0) + 1;
      const maxAttempts = 5;
      
      if (attempts >= maxAttempts) {
        await User.findByIdAndUpdate(user._id, {
          $set: {
            "access_control.last_login_attempt": attempts,
            "access_control.is_locked": true,
            "access_control.reason": "Account locked due to too many failed login attempts"
          }
        });
        
        return res.status(403).json({
          status: false,
          error: "Account locked",
          message: "Account locked due to too many failed login attempts. Please contact administrator or reset password.",
          data: {
            isLocked: true
          }
        });
      }
      
      await User.findByIdAndUpdate(user._id, {
        $set: {
          "access_control.last_login_attempt": attempts
        }
      });
      
      return res.status(401).json({
        status: false,
        error: "Invalid credentials",
        message: `Invalid email or password. Attempts remaining: ${maxAttempts - attempts}`,
        data: {
          remainingAttempts: maxAttempts - attempts
        }
      });
    }

    // Reset login attempts on successful password verification
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "access_control.last_login_attempt": 0
      }
    });
    
    // Generate OTP for 2FA
    const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();

    // Hash the OTP for database storage
    const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());

    // Calculate expiry time
    const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

    // Store OTP in database
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "auth.access_token.token": hashedOTP,
        "auth.access_token.token_type": "otp",
        "auth.access_token.expires_at": otpExpiry
      }
    });

    // Send OTP via email
    const sent = await email.sendOTPEmail(userEmail, otpCode || 1234, "login");

    console.log(
      `Generated OTP for user ${userEmail}: ${otpCode} (hashed: ${hashedOTP}, expires in 5 mins)`,
    );

    console.log(
      `OTP for user ${userEmail}: ${otpCode} (sent: ${JSON.stringify(sent)})`,
    );
    console.log(
      `Generated OTP for user ${userEmail}: ${otpCode} (expires at: ${expiresAt})`,
    );

    return res.status(200).json({
      status: true,
      error: null,
      message: "OTP sent to your email. Please verify to complete login.",
      data: {
        requiresOTP: true,
        userId: user._id,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = login;
