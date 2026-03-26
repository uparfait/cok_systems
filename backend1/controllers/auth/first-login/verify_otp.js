/**
 * Verify OTP Controller
 * Step 2b: Verify OTP without setting password
 * Use this endpoint to verify OTP before setting password
 */

const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

const EXPECTED_TOKEN_TYPE = 'first_login_otp';
const OTP_VERIFICATION_TYPE = 'otp_verification';

async function verifyOTP(req, res, next) {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        status: false,
        error: "User ID and OTP are required",
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
    
    if (storedTokenType !== EXPECTED_TOKEN_TYPE) {
      return res.status(400).json({
        status: false,
        error: "Invalid token type",
        message: "Please request a new OTP.",
      });
    }

    const storedOTP = user.auth.access_token.token;

    if (!storedOTP) {
      return res.status(400).json({
        status: false,
        error: "No OTP found",
        message: "Please request a new OTP.",
      });
    }

    // Verify OTP
    const hashMatch = await tokenUtil.compareToken(otp.toString(), storedOTP);

    if (!hashMatch) {
      return res.status(400).json({
        status: false,
        error: "Invalid OTP",
        message: "OTP verification failed. It may have expired or is incorrect. Please request a new OTP.",
      });
    }

    // Generate signature token for password set verification (expires in 30 minutes)
    const signature = tokenUtil.generateToken({ userId: user._id.toString() }, '30m', OTP_VERIFICATION_TYPE);

    // OTP is valid
    return res.status(200).json({
      status: true,
      error: null,
      message: "OTP verified successfully. You can now set your password.",
      data: {
        signature: signature,
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = verifyOTP;
