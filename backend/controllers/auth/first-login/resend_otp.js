/**
 * Resend OTP Controller
 * Resend/generate new TOTP secret and QR code for first login
 */

const totp = require("../../../utilities/totp");
const User = require("../../../models/user");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";
const TOTP_SETUP_TTL_MINUTES = 15;

async function resendOTP(req, res, next) {
  try {
    const { userId, email: userEmail } = req.body;

    if (!userId || !userEmail) {
      return res.status(400).json({
        status: false,
        error: "User ID and email are required",
        message: null,
      });
    }

    // Verify user exists and is not activated
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

    if (user.is_account_activated) {
      return res.status(400).json({
        status: false,
        error: "Account already activated",
        message: "This account is already active.",
      });
    }

    // Generate new TOTP secret and QR code
    const normalizedEmail = userEmail.trim().toLowerCase();
    const { secret, otpauthUrl } = totp.generateTOTPSecret(normalizedEmail);
    const qrCodeDataUrl = await totp.generateQRCode(otpauthUrl);
    const setupExpiry = totp.createTOTPSetupExpiry(TOTP_SETUP_TTL_MINUTES);

    // Update the secret in database (temporary, until user verifies)
    // Clear any old twofa_secret to prevent conflicts with old code versions
    await User.findByIdAndUpdate(userId, {
      $set: {
        twofa_secret: null,
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
        "twofa_verification.locked_until": null
      }
    });

    await logAuditEvent('SYSTEM', `TOTP setup resent for first login: ${normalizedEmail}`, req, {
      resource: 'auth',
      resource_id: user._id.toString(),
      status_code: 200,
      metadata: {
        email: normalizedEmail,
        purpose: 'first_login_resend'
      }
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: "New TOTP setup generated. Please scan the QR code with your authenticator app.",
      data: {
        userId: user._id,
        email: normalizedEmail,
        secret: secret,
        qrCode: qrCodeDataUrl,
        otpauthUrl: otpauthUrl,
        expiresAt: setupExpiry
      },
    });

  } catch (error) {
    next(error);
  }
}

module.exports = resendOTP;
