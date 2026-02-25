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


const SALT_ROUNDS = 10;

// Configuration for login attempts

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MESSAGE = "Account locked due to too many failed login attempts. Please contact administrator to unlock your account";

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

    // Check user in database and verify password using bcrypt
    const user = await User.findOne({ email: userEmail });

    // If user not found or password doesn't match
    if (!user || !(await bcrypt.compare(password.trim(), user.password))) {

      let loginAttempts = 0;


      // check if user email exists to track login attempts and lock account if necessary
      const userByEmail = await User.findOne({ email: userEmail });
      if (userByEmail) {

        // check if account is locked

        if (userByEmail.access_control?.is_locked) {
          return res.status(403).json({
            status: false,
            error: LOCK_MESSAGE,
            message: LOCK_MESSAGE,
            data: {
              isLocked: true,
              reason: userByEmail.access_control.reason
            }
          });
        }

        // Initialize access_control if not exists
        if (!userByEmail.access_control) {
          userByEmail.access_control = {
            is_locked: false,
            reason: null,
            last_login_attempt: 1
          };
          await userByEmail.save();

          loginAttempts = 1;
        } else {
          const last_attempt = (userByEmail.access_control.last_login_attempt || 0) + 1
          userByEmail.access_control.last_login_attempt = last_attempt

          loginAttempts = last_attempt;
          // Check if should lock account
          if (last_attempt >= MAX_LOGIN_ATTEMPTS) {
            userByEmail.access_control.is_locked = true;
            userByEmail.access_control.reason = `Account locked after ${MAX_LOGIN_ATTEMPTS} failed login attempts`;
          }
          await userByEmail.save();
        }
      }




      return res.status(401).json({
        status: false,
        error: loginAttempts === 0 ? "Invalid email or password" : loginAttempts >= MAX_LOGIN_ATTEMPTS ? LOCK_MESSAGE : `Invalid password. You have ${MAX_LOGIN_ATTEMPTS - loginAttempts} attempts left before account lock.`,
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

    // Store OTP in database (plain OTP for JWT verification comparison)
    const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

    await User.findByIdAndUpdate(user._id, {
      $set: {
        "auth.access_token.token": otpCode.toString(),
        "auth.access_token.token_type": "otp",
        "auth.access_token.expires_at": otpExpiry
      }
    });

    // Create JWT token containing the OTP for secure transmission
    const otpPayload = {
      userId: user._id.toString(),
      otp: otpCode.toString(),
      purpose: 'login_verification'
    };

    // Sign JWT with short expiry (5 minutes)
    const otpToken = jwt.sign(otpPayload, jwt.JWT_SECRET, {
      expiresIn: '5m'
    });

    // Send OTP via email (user sees just the OTP, not the JWT)
    const sent = await email.sendOTPEmail(userEmail, otpCode || 1234, "login");


    return res.status(200).json({
      status: true,
      error: null,
      message: "OTP sent to your email. Please verify to complete login.",
      data: {
        requiresOTP: true,
        userId: user._id,
        // Also send the JWT token for verification
        otpToken: otpToken
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: "An error occurred during login",
      message:  "An unexpected error occurred"
    });
  }
}

module.exports = login;
