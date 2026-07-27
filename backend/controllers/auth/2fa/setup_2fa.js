/**
 * Setup 2FA Controller
 * Generate TOTP secret and QR code for 2FA setup
 */

const totp = require("../../../utilities/totp");
const jwt = require("../../../utilities/jwt");
const User = require("../../../models/user");
const { logAuditEvent } = require("../../../middlewares/audit");

const TOTP_SETUP_TTL_MINUTES = 15;

async function setup2FA(req, res, next) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        status: false,
        error: "User ID is required",
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

    // Generate TOTP secret and QR code
    const { secret, otpauthUrl } = totp.generateTOTPSecret(user.email);
    const qrCodeDataUrl = await totp.generateQRCode(otpauthUrl);
    const setupExpiry = totp.createTOTPSetupExpiry(TOTP_SETUP_TTL_MINUTES);

    // Store TOTP setup data in dedicated twofa_setup fields (NOT in twofa_secret until user verifies)
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

    await logAuditEvent('SYSTEM', `2FA setup initiated for user: ${user.email}`, req, {
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
      message: "TOTP secret generated. Please scan the QR code with your authenticator app.",
      data: {
        userId: user._id,
        email: user.email,
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

module.exports = setup2FA;
