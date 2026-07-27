/**
 * Login Controller
 * Handles user login - verifies credentials, manages login attempts, and supports 2FA
 */

const jwt = require("../../../utilities/jwt");
const totp = require("../../../utilities/totp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const bcrypt = require("bcrypt");
const User = require("../../../models/user");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

const SALT_ROUNDS = 10;

// Configuration for login attempts
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MESSAGE =
  "Account locked due to too many failed login attempts. Please contact administrator to unlock your account";

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

    if (user) {
      // Check if account is activated (for first-time login users)
      if (!user.is_account_activated) {
        return res.status(403).json({
          status: false,
          error: "Account not activated",
          message: "Please use First-Time Login to activate your account",
          data: {
            requiresActivation: true,
            email: userEmail,
          },
        });
      }
    }

    // If user not found or password doesn't match
    if (!user || !(await bcrypt.compare(password.trim(), user.password))) {
      let loginAttempts = 0;

      // check if user email exists to track login attempts and lock account if necessary
      const userByEmail = await User.findOne({ email: userEmail });
      if (userByEmail) {
        // check if account is locked

        if (userByEmail.access_control?.is_locked) {
          // Log access attempt on locked account
          await logAuditEvent('SYSTEM', `Access attempt on locked account: ${userEmail}`, req, {
            resource: 'users',
            resource_id: userByEmail._id.toString(),
            status_code: 403,
            metadata: {
              reason: userByEmail.access_control.reason,
              email: userEmail
            }
          });

          return res.status(403).json({
            status: false,
            error: LOCK_MESSAGE,
            message: LOCK_MESSAGE,
            data: {
              isLocked: true,
              reason: userByEmail.access_control.reason,
            },
          });
        }

        // Initialize access_control if not exists
        if (!userByEmail.access_control) {
          userByEmail.access_control = {
            is_locked: false,
            reason: null,
            last_login_attempt: 1,
          };
          await userByEmail.save();

          loginAttempts = 1;
        } else {
          const last_attempt =
            (userByEmail.access_control.last_login_attempt || 0) + 1;
          userByEmail.access_control.last_login_attempt = last_attempt;

          loginAttempts = last_attempt;
          // Check if should lock account
          if (last_attempt >= MAX_LOGIN_ATTEMPTS) {
            userByEmail.access_control.is_locked = true;
            userByEmail.access_control.reason = `Account locked after ${MAX_LOGIN_ATTEMPTS} failed login attempts`;

            // Log account lock event
            await logAuditEvent('SYSTEM', `Account locked due to ${MAX_LOGIN_ATTEMPTS} failed login attempts`, req, {
              resource: 'users',
              resource_id: userByEmail._id.toString(),
              metadata: {
                reason: 'too_many_failed_attempts',
                attempts: last_attempt,
                email: userEmail
              }
            });
          }
          await userByEmail.save();
        }
      }

      return res.status(401).json({
        status: false,
        error:
          loginAttempts === 0
            ? "Invalid email or password"
            : loginAttempts >= MAX_LOGIN_ATTEMPTS
              ? LOCK_MESSAGE
              : `Invalid password. You have ${MAX_LOGIN_ATTEMPTS - loginAttempts} attempts left before account lock.`,
        message: null,
      });
    }

    // Initialize access_control if not exists
    if (!user.access_control) {
      user.access_control = {
        is_locked: false,
        reason: null,
        last_login_attempt: 0,
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
          reason: user.access_control.reason,
        },
      });
    }

    // Verify password before proceeding
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
            "access_control.reason":
              "Account locked due to too many failed login attempts",
          },
        });

        // Log account lock
        await logAuditEvent('SYSTEM', `Account locked due to ${maxAttempts} failed login attempts: ${userEmail}`, req, {
          resource: 'users',
          resource_id: user._id.toString(),
          status_code: 403,
          metadata: {
            reason: 'too_many_failed_attempts',
            attempts: attempts,
            email: userEmail
          }
        });

        return res.status(403).json({
          status: false,
          error: "Account locked",
          message:
            "Account locked due to too many failed login attempts. Please contact administrator or reset password.",
          data: {
            isLocked: true,
          },
        });
      }

      await User.findByIdAndUpdate(user._id, {
        $set: {
          "access_control.last_login_attempt": attempts,
        },
      });

      return res.status(401).json({
        status: false,
        error: "Invalid credentials",
        message: `Invalid email or password. Attempts remaining: ${maxAttempts - attempts}`,
        data: {
          remainingAttempts: maxAttempts - attempts,
        },
      });
    }

    // Reset login attempts on successful password verification
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "access_control.last_login_attempt": 0,
      },
    });

    // Check if 2FA is explicitly disabled by admin
    const is2FADisabled = user.is_2FA_disabled === true;

    if (is2FADisabled) {
      // 2FA is disabled, generate tokens directly
      const userRole = user.roles?.role_name || 'user';
      const userPermissions = user.roles?.permissions || [];

      const payload = {
        userId: user._id.toString(),
        email: user.email,
        fullName: user.full_name,
        role: userRole,
        permissions: userPermissions
      };

      const accessToken = jwt.generateAccessToken(payload);
      const refreshToken = jwt.generateRefreshToken({ userId: user._id.toString() });

      // Log successful login
      // await logAuditEvent('SYSTEM', `User logged in successfully (2FA disabled): ${userEmail}`, req, {
      //   resource: 'auth',
      //   resource_id: user._id.toString(),
      //   status_code: 200,
      //   metadata: {
      //     email: userEmail,
      //     two_fa_disabled: true
      //   }
      // });

      return res.status(200).json({
        status: true,
        error: null,
        message: "Login successful",
        data: {
          verified: true,
          userId: user._id,
          email: user.email,
          fullName: user.full_name,
          role: userRole,
          telephone: user.telephone,
          department_name: user.department_name,
          department_id: user.department_id,
          permissions: userPermissions,
          accessToken: accessToken,
          refreshToken: refreshToken,
          requiresOTP: false,
          twoFADisabled: true
        },
      });
    }

    // 2FA is enabled - check if user has set up TOTP secret
    if (!user.twofa_secret) {
     
      const { secret, otpauthUrl } = totp.generateTOTPSecret(user.email);
      const qrCodeDataUrl = await totp.generateQRCode(otpauthUrl);

      // Store the secret temporarily (NOT saved to twofa_secret until user verifies)
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await User.findByIdAndUpdate(user._id, {
        $set: {
          auth: {
            access_token: {
              token_type: "2fa_setup",
              token: secret,
              expires_at: otpExpiry
            }
          }
        }
      });

      // Log 2FA setup required
      // await logAuditEvent('SYSTEM', `2FA setup required for user: ${userEmail}`, req, {
      //   resource: 'auth',
      //   resource_id: user._id.toString(),
      //   status_code: 200,
      //   metadata: {
      //     email: userEmail,
      //     purpose: '2fa_setup_required'
      //   }
      // });

      return res.status(200).json({
        status: true,
        error: null,
        message: "Two-factor authentication setup required. Please scan the QR code with your authenticator app.",
        data: {
          requiresTOTPSetup: true,
          userId: user._id,
          email: user.email,
          secret: secret,
          qrCode: qrCodeDataUrl,
          otpauthUrl: otpauthUrl
        },
      });
    }

    // 2FA is enabled and secret exists - generate OTP JWT for TOTP verification
    const userRole = user.roles?.role_name || 'user';
    const userPermissions = user.roles?.permissions || [];

    const otpPayload = {
      userId: user._id.toString(),
      email: user.email,
      fullName: user.full_name,
      role: userRole,
      permissions: userPermissions
    };

    const otpToken = jwt.generateAccessToken({ ...otpPayload, purpose: 'login_verification' });

    // Store the JWT token in database
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await User.findByIdAndUpdate(user._id, {
      $set: {
        auth: {
          access_token: {
            token: otpToken,
            token_type: "login_totp",
            expires_at: otpExpiry
          }
        }
      }
    });

    // Log successful password verification, awaiting TOTP
    await logAuditEvent('SYSTEM', `Password verified, awaiting TOTP for login: ${userEmail}`, req, {
      resource: 'auth',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: {
        email: userEmail,
        purpose: 'login_verification'
      }
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: "Please verify your TOTP token to complete login.",
      data: {
        requiresOTP: true,
        userId: user._id,
        email: user.email,
        twoFADisabled: false
      },
    });

  } catch (error) {
    console.error("Error during login process:", error);
    return res.status(500).json({
      status: false,
      error: "An error occurred during login",
      message: "An unexpected error occurred",
    });
  }
}

module.exports = login;
