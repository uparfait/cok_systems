/**
 * Verify 2FA Setup Controller
 * Verify TOTP token during 2FA setup
 */

const totp = require("../../../utilities/totp");
const jwt = require("../../../utilities/jwt");
const User = require("../../../models/user");
const { logAuditEvent } = require("../../../middlewares/audit");

const OTP_VERIFICATION_TYPE = 'otp_verification';
const MAX_TOTP_ATTEMPTS = 5;
const TOTP_LOCKOUT_MINUTES = 15;
const TOTP_SETUP_TTL_MINUTES = 15;

async function verify2FASetup(req, res, next) {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        status: false,
        error: "User ID and TOTP token are required",
        message: null,
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        error: "User not found",
        message: null,
      });
    }

    // Get stored TOTP secret from twofa_setup
    const storedSecret = user.twofa_setup?.secret || user.twofa_secret;

    if (!storedSecret) {
      return res.status(400).json({
        status: false,
        error: "No TOTP secret found",
        message: "Please initiate 2FA setup first.",
      });
    }

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
        message: "Your 2FA setup session has expired. Please try again to generate a new QR code.",
      });
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
        updateData["access_control.reason"] = `Account locked due to ${MAX_TOTP_ATTEMPTS} failed 2FA setup attempts`;

        await logAuditEvent('SECURITY', `Account locked due to ${MAX_TOTP_ATTEMPTS} failed 2FA setup attempts: ${user.email}`, req, {
          resource: 'auth',
          resource_id: user._id.toString(),
          status_code: 403,
          metadata: {
            email: user.email,
            reason: 'too_many_2fa_setup_failed_attempts',
            attempts: attempts
          }
        });
      } else {
        await logAuditEvent('SECURITY', `Failed 2FA setup attempt ${attempts}/${MAX_TOTP_ATTEMPTS} for: ${user.email}`, req, {
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
        error: "Invalid TOTP",
        message: attempts >= MAX_TOTP_ATTEMPTS 
          ? `Account locked for ${TOTP_LOCKOUT_MINUTES} minutes due to too many failed attempts.`
          : `TOTP verification failed. You have ${MAX_TOTP_ATTEMPTS - attempts} attempts remaining.`,
      });
    }

    // TOTP is valid - save secret permanently and clear setup data
    await User.findByIdAndUpdate(userId, {
      $set: {
        twofa_secret: storedSecret,
        twofa_setup: {
          secret: null,
          qr_code: null,
          otpauth_url: null,
          created_at: null,
          expires_at: null,
          verified: true
        },
        "twofa_verification.attempts": 0,
        "twofa_verification.last_attempt": null,
        "twofa_verification.locked_until": null
      }
    });

    // Generate signature token for 2FA verification (expires in 30 minutes)
    const signature = jwt.sign({ userId: user._id.toString(), purpose: OTP_VERIFICATION_TYPE }, jwt.JWT_SECRET, {
      expiresIn: '30m'
    });

    await logAuditEvent('SYSTEM', `2FA setup verified for user: ${user.email}`, req, {
      resource: 'users',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: {
        email: user.email,
        purpose: '2fa_setup'
      }
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: "TOTP verified successfully. 2FA is now enabled for your account.",
      data: {
        signature: signature,
        userId: user._id,
        email: user.email
      },
    });

  } catch (error) {
    next(error);
  }
}

module.exports = verify2FASetup;
