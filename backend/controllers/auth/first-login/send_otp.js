/**
 * Send OTP Controller
 * Step 2: Generate TOTP secret and QR code for 2FA setup during first login
 */

const totp = require("../../../utilities/totp");
const User = require("../../../models/user");

// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";
const TOTP_SETUP_TTL_MINUTES = 15;

async function sendOTP(req, res, next) {
  try {
    const { email: userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({
        status: false,
        error: "Email is required",
        message: null,
      });
    }

    const normalizedEmail = userEmail.trim().toLowerCase();

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        status: false,
        error: "Account not found",
        message: "No account found with this email.",
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
        message: "This account is already active. Please use the regular login.",
      });
    }

    // Generate TOTP secret and QR code
    const { secret, otpauthUrl } = totp.generateTOTPSecret(normalizedEmail);
    const qrCodeDataUrl = await totp.generateQRCode(otpauthUrl);
    const setupExpiry = totp.createTOTPSetupExpiry(TOTP_SETUP_TTL_MINUTES);

    // Store TOTP setup data in dedicated twofa_setup fields (NOT in twofa_secret until user verifies)
    // Clear any old twofa_secret to prevent conflicts with old code versions
    await User.findByIdAndUpdate(user._id, {
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

    return res.status(200).json({
      status: true,
      error: null,
      message: "TOTP secret generated. Please scan the QR code with your authenticator app.",
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

module.exports = sendOTP;
