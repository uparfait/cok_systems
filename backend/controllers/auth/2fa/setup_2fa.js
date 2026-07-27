
const totp = require("../../../utilities/totp");
const jwt = require("../../../utilities/jwt");
const User = require("../../../models/user");
const { logAuditEvent } = require("../../../middlewares/audit");

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

    // Temporarily store the secret until verified
    await User.findByIdAndUpdate(userId, {
      $set: {
        twofa_secret: secret,
        auth: {
          access_token: {
            token_type: "2fa_setup",
            token: secret
          }
        }
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
        otpauthUrl: otpauthUrl
      },
    });

  } catch (error) {
    next(error);
  }
}

module.exports = setup2FA;
