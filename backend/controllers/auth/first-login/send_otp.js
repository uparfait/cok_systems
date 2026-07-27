
const totp = require("../../../utilities/totp");
const User = require("../../../models/user");

// Lock message
const LOCK_MESSAGE = "Account is locked. Please contact administrator.";

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

    console.log(secret)

    // Store the secret temporarily in auth.access_token only (NOT in twofa_secret until user verifies)
    await User.findByIdAndUpdate(user._id, {
      $set: {
        auth: {
          access_token: {
            token_type: "first_login_totp",
            token: secret
          }
        }
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
        otpauthUrl: otpauthUrl
      },
    });

  } catch (error) {
    next(error);
  }
}

module.exports = sendOTP;
