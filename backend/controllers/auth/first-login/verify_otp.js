/**
 * Verify OTP Controller
 * Step 2b: Verify TOTP token for first login
 */

const totp = require("../../../utilities/totp");
const User = require("../../../models/user");

const OTP_VERIFICATION_TYPE = 'otp_verification';

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

    // Check token type
    const storedTokenType = user.auth?.access_token?.token_type;
    
    if (storedTokenType !== "first_login_totp") {
      return res.status(400).json({
        status: false,
        error: "Invalid token type",
        message: "Please request a new TOTP setup.",
      });
    }

    const storedSecret = user.twofa_secret || user.auth?.access_token?.token;

    if (!storedSecret) {
      return res.status(400).json({
        status: false,
        error: "No TOTP secret found",
        message: "Please request a new TOTP setup.",
      });
    }

    // Verify TOTP token
    const verificationResult = totp.verifyTOTPToken(otp.toString(), storedSecret);
    console.log(verificationResult)

    if (!verificationResult.valid) {
      return res.status(400).json({
        status: false,
        error: "Invalid TOTP",
        message: "TOTP verification failed. Please check your authenticator app and try again.",
      });
    }

    // Save the TOTP secret permanently only after successful verification
    // The secret was temporarily stored in auth.access_token.token during setup
    await User.findByIdAndUpdate(userId, {
      $set: {
        twofa_secret: storedSecret,
        auth: {
          access_token: {
            token: null,
            token_type: null,
            expires_at: null
          }
        }
      }
    });

    // Generate signature token for password set verification (expires in 30 minutes)
    const jwt = require("../../../utilities/jwt");
    const signature = jwt.sign({ userId: user._id.toString(), purpose: OTP_VERIFICATION_TYPE }, jwt.JWT_SECRET, {
      expiresIn: '30m'
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
