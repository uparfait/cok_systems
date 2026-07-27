/**
 * Verify 2FA Setup Controller
 * Verify TOTP token during 2FA setup
 */

const totp = require("../../../utilities/totp");
const jwt = require("../../../utilities/jwt");
const User = require("../../../models/user");
const { logAuditEvent } = require("../../../middlewares/audit");

const OTP_VERIFICATION_TYPE = 'otp_verification';

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

    const storedSecret = user.twofa_secret || user.auth?.access_token?.token;

    if (!storedSecret) {
      return res.status(400).json({
        status: false,
        error: "No TOTP secret found",
        message: "Please initiate 2FA setup first.",
      });
    }

    // Verify TOTP token
    const verificationResult = totp.verifyTOTPToken(otp.toString(), storedSecret);

    if (!verificationResult.valid) {
      return res.status(400).json({
        status: false,
        error: "Invalid TOTP",
        message: "TOTP verification failed. Please check your authenticator app and try again.",
      });
    }

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
