/**
 * Verify OTP Controller
 * Step 2b: Verify TOTP token for first login
 */

const totp = require("../../../utilities/totp");
const jwt = require("../../../utilities/jwt");
const User = require("../../../models/user");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

const OTP_VERIFICATION_TYPE = 'otp_verification';
const MAX_TOTP_ATTEMPTS = 5;
const TOTP_LOCKOUT_MINUTES = 15;
const TOTP_SETUP_TTL_MINUTES = 15;

async function verifyOTP(req, res, next) {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        status: false,
        error: "User ID and TOTP token are required",
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

    // Check if account is already activated
    if (user.is_account_activated) {
      return res.status(400).json({
        status: false,
        error: "Account already activated",
        message: "This account is already active.",
      });
    }

    // Get stored TOTP secret from twofa_setup (first-login flow) or twofa_secret (normal login)
    // IMPORTANT: For first-login, prioritize twofa_setup.secret over twofa_secret
    // because twofa_secret may contain an old value from previous code versions
    const storedSecret = user.twofa_setup?.secret || user.twofa_secret;

    if (!storedSecret) {
      return res.status(400).json({
        status: false,
        error: "No TOTP secret found",
        message: "Please request a new TOTP setup.",
      });
    }

    // Check if this is a setup verification (secret in twofa_setup but not yet in twofa_secret)
    const isSetupVerification = !!user.twofa_setup?.secret && !user.twofa_secret;

    if (isSetupVerification) {
      // Check TOTP setup expiry
      if (totp.isTOTPSetupExpired(user.twofa_setup?.expires_at, TOTP_SETUP_TTL_MINUTES)) {
        // Clear expired setup
        await User.findByIdAndUpdate(userId, {
          $set: {
            twofa_setup: {
              secret: null,
              qr_code: null,
              otpauth_url: null,
              created_at: null,
              expires_at: null,
              verified: false
            }
          }
        });

        return res.status(400).json({
          status: false,
          error: "TOTP setup expired",
          message: "Your TOTP setup session has expired. Please try again to generate a new QR code.",
        });
      }
    }

    // Check TOTP verification lockout
    const verification = user.twofa_verification || {};
    const now = new Date();
    
    if (verification.locked_until && now < new Date(verification.locked_until)) {
      const remainingMinutes = Math.ceil((new Date(verification.locked_until) - now) / (1000 * 60));
      return res.status(403).json({
        status: false,
        error: "Too many failed attempts",
        message: `Account locked for ${remainingMinutes} minutes due to too many failed TOTP attempts. Please try again later.`,
      });
    }

    // Verify TOTP token
    const verificationResult = totp.verifyTOTPToken(otp.toString(), storedSecret);

    if (!verificationResult.valid) {
      // Increment failed attempts
      const attempts = (verification.attempts || 0) + 1;
    const updateData = {
        "twofa_verification.attempts": attempts,
        "twofa_verification.last_attempt": now
      };

      // Lock account if max attempts reached
      if (attempts >= MAX_TOTP_ATTEMPTS) {
        const lockedUntil = new Date(now.getTime() + TOTP_LOCKOUT_MINUTES * 60 * 1000);
        updateData["twofa_verification.locked_until"] = lockedUntil;
        
        // Also lock the user account
        updateData["access_control.is_locked"] = true;
        updateData["access_control.reason"] = `Account locked due to ${MAX_TOTP_ATTEMPTS} failed TOTP verification attempts`;

        await logAuditEvent('SECURITY', `Account locked due to ${MAX_TOTP_ATTEMPTS} failed TOTP attempts: ${user.email}`, req, {
          resource: 'auth',
          resource_id: user._id.toString(),
          status_code: 403,
          metadata: {
            email: user.email,
            reason: 'too_many_totp_failed_attempts',
            attempts: attempts
          }
        });
      } else {
        await logAuditEvent('SECURITY', `Failed TOTP attempt ${attempts}/${MAX_TOTP_ATTEMPTS} for: ${user.email}`, req, {
          resource: 'auth',
          resource_id: user._id.toString(),
          status_code: 400,
          metadata: {
            email: user.email,
            attempts: attempts,
            remaining: MAX_TOTP_ATTEMPTS - attempts
          }
        });
      }

      await User.findByIdAndUpdate(userId, { $set: updateData });

      return res.status(400).json({
        status: false,
        error: attempts >= MAX_TOTP_ATTEMPTS 
          ? `Account locked for ${TOTP_LOCKOUT_MINUTES} minutes due to too many failed attempts.`
          : `TOTP verification failed. You have ${MAX_TOTP_ATTEMPTS - attempts} attempts remaining.`,
        message: attempts >= MAX_TOTP_ATTEMPTS 
          ? `Account locked for ${TOTP_LOCKOUT_MINUTES} minutes due to too many failed attempts.`
          : `TOTP verification failed. You have ${MAX_TOTP_ATTEMPTS - attempts} attempts remaining.`,
      });
    }

    // TOTP is valid - reset attempts
    const updateData = {
      "twofa_verification.attempts": 0,
      "twofa_verification.last_attempt": null,
      "twofa_verification.locked_until": null
    };

    // If this was a setup verification, save the secret permanently and clear setup data
    if (isSetupVerification) {
      updateData.twofa_secret = storedSecret;
      updateData.twofa_setup = {
        secret: null,
        qr_code: null,
        otpauth_url: null,
        created_at: null,
        expires_at: null,
        verified: true
      };
    }

    // Clear auth tokens - handle case where auth.access_token might be null
    // MongoDB cannot create nested fields inside a null parent element
    if (user.auth?.access_token === null) {
      await User.findByIdAndUpdate(userId, { $set: { "auth.access_token": {} } });
    }
    updateData["auth.access_token.token"] = null;
    updateData["auth.access_token.token_type"] = null;
    updateData["auth.access_token.expires_at"] = null;

    await User.findByIdAndUpdate(userId, { $set: updateData });

    // Generate signature token for password set verification (expires in 30 minutes)
    const signature = jwt.sign({ userId: user._id.toString(), purpose: OTP_VERIFICATION_TYPE }, jwt.JWT_SECRET, {
      expiresIn: '30m'
    });

    // Log successful TOTP verification
    await logAuditEvent('SYSTEM', `TOTP verified successfully for first login: ${user.email}`, req, {
      resource: 'auth',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: {
        email: user.email,
        purpose: 'first_login_verification',
        was_setup: isSetupVerification
      }
    });

    // OTP is valid
    return res.status(200).json({
      status: true,
      error: null,
      message: "TOTP verified successfully. You can now set your password.",
      data: {
        signature: signature,
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = verifyOTP;
