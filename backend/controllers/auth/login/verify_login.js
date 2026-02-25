/**
 * Verify Login Controller
 * Verifies OTP and issues JWT token (Bearer token - valid for 1 day)
 * Also manages login attempts and account locking
 */

const jwt = require("../../../utilities/jwt");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

// JWT expiry for login - 1 day
const LOGIN_TOKEN_EXPIRY = '1d';

// Expected token type for login OTP
const EXPECTED_TOKEN_TYPE = 'otp';

// Login attempt configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MESSAGE = "Account locked due to too many failed login attempts. Please contact administrator or reset password.";

/**
 * Helper function to increment login attempts and optionally lock account
 */
async function handleFailedLoginAttempt(userId) {
  const user = await User.findById(userId);
  
  if (!user) return null;

  // Initialize access_control if not exists
  if (!user.access_control) {
    user.access_control = {
      is_locked: false,
      reason: null,
      last_login_attempt: 0
    };
  }

  // Increment login attempts
  const attempts = (user.access_control.last_login_attempt || 0) + 1;
  
  let isLocked = user.access_control.is_locked;
  let lockReason = null;

  // Check if should lock account
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    isLocked = true;
    lockReason = `Account locked after ${MAX_LOGIN_ATTEMPTS} failed login attempts`;
  }

  await User.findByIdAndUpdate(userId, {
    $set: {
      "access_control.last_login_attempt": attempts,
      "access_control.is_locked": isLocked
    }
  });

  return {
    attempts,
    isLocked,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - attempts)
  };
}

/**
 * Helper function to reset login attempts on successful login
 */
async function resetLoginAttempts(userId) {
  await User.findByIdAndUpdate(userId, {
    $set: {
      "access_control.last_login_attempt": 0
    }
  });
}

async function verifyLogin(req, res, next) {
  try {
    const { userId, otp: inputOTP } = req.body;

    if (!userId || !inputOTP) {
      return res.status(400).json({
        status: false,
        error: 'User ID and OTP are required',
        message: null
      });
    }

    // Get user from database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        status: false,
        error: 'User not found',
        message: null
      });
    }

    // Initialize access_control if not exists
    if (!user.access_control) {
      user.access_control = {
        is_locked: false,
        reason: null,
        last_login_attempt: 0
      };
    }

    // Check if account is locked
    if (user.access_control.is_locked) {
      return res.status(403).json({
        status: false,
        error: 'Account is locked',
        message: LOCK_MESSAGE,
        data: {
          isLocked: true,
          reason: user.access_control.reason,
          attempts: user.access_control.last_login_attempt
        }
      });
    }

    // Check token type stored in database
    const storedTokenType = user.auth?.access_token?.token_type;
    
    if (storedTokenType !== EXPECTED_TOKEN_TYPE) {
      return res.status(400).json({
        status: false,
        error: 'Invalid token type',
        message: `Invalid token type`
      });
    }

    // Get stored OTP from database
    const storedOTP = user.auth?.access_token?.token;
    const otpExpiry = user.auth?.access_token?.expires_at;

    if (!storedOTP) {
      // Handle failed attempt even for missing OTP
      const attemptResult = await handleFailedLoginAttempt(userId);
      
      return res.status(400).json({
        status: false,
        error: 'OTP expired or not found',
        message: attemptResult?.remainingAttempts 
          ? `Please request a new OTP. Attempts remaining: ${attemptResult.remainingAttempts}`
          : 'Please request a new OTP.',
        data: attemptResult ? {
          attempts: attemptResult.attempts,
          isLocked: attemptResult.isLocked,
          remainingAttempts: attemptResult.remainingAttempts
        } : undefined
      });
    }

    // Check if OTP has expired
    if (otpExpiry && new Date() > new Date(otpExpiry)) {
      // Handle expired OTP as failed attempt
      const attemptResult = await handleFailedLoginAttempt(userId);

      // Clear expired OTP
      await User.findByIdAndUpdate(userId, {
        $set: {
          'auth.access_token.token': null,
          'auth.access_token.token_type': null,
        }
      });

      return res.status(400).json({
        status: false,
        error: 'OTP has expired',
        message: attemptResult?.remainingAttempts 
          ? `Please request a new OTP. Attempts remaining: ${attemptResult.remainingAttempts}`
          : 'Please request a new OTP.',
        data: attemptResult ? {
          attempts: attemptResult.attempts,
          isLocked: attemptResult.isLocked,
          remainingAttempts: attemptResult.remainingAttempts
        } : undefined
      });
    }

    // Validate OTP (compare hashed values)
    const hashMatch = await tokenUtil.compareToken(inputOTP.toString(), storedOTP);

    if (!hashMatch) {
      // Handle failed OTP as failed login attempt
      const attemptResult = await handleFailedLoginAttempt(userId);

      if (attemptResult?.isLocked) {
        return res.status(403).json({
          status: false,
          error: 'Account locked',
          message: LOCK_MESSAGE,
          data: {
            isLocked: true,
            attempts: attemptResult.attempts,
            reason: attemptResult.isLocked ? `Account locked after ${MAX_LOGIN_ATTEMPTS} failed login attempts` : null
          }
        });
      }

      return res.status(400).json({
        status: false,
        error: 'Invalid OTP',
        message: `The OTP you entered is incorrect. Attempts remaining: ${attemptResult?.remainingAttempts || 0}`,
        data: {
          attempts: attemptResult?.attempts || 1,
          isLocked: attemptResult?.isLocked || false,
          remainingAttempts: attemptResult?.remainingAttempts || 0
        }
      });
    }

    // OTP valid - clear it from database (one-time use)
    await User.findByIdAndUpdate(userId, {
      $set: {
        'auth.access_token.token': null,
        'auth.access_token.token_type': null,
      }
    });

    // Reset login attempts on successful login
    await resetLoginAttempts(userId);

    // Generate JWT Bearer token with 1 day expiry (NOT stored in database)
    const tokenPayload = {
      userId: user._id,
      email: user.email,
      role: user.roles?.role_name || 'system_admin',
      permissions: user.roles?.permissions || []
    };

    const bearerToken = jwt.sign(tokenPayload, jwt.JWT_SECRET, {
      expiresIn: LOGIN_TOKEN_EXPIRY
    });

    // Generate refresh token (7 days)
    const refreshToken = jwt.generateRefreshToken(tokenPayload);

    return res.status(200).json({
      status: true,
      error: null,
      message: 'Login successful',
      data: {
        user: {
          userId: user._id,
          email: user.email,
          fullName: user.full_name,
          role: user.roles?.role_name || 'system_admin',
          permissions: user.roles?.permissions || []
        },
        tokens: {
          bearerToken: bearerToken,
          refreshToken: refreshToken,
          expiresIn: LOGIN_TOKEN_EXPIRY
        }
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = verifyLogin;
