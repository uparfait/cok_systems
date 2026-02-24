/**
 * Verify OTP Controller
 * Step 2: Verify OTP and allow password change
 */

const otp = require("../../../utilities/otp");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

// Expected token type for password reset OTP
const EXPECTED_TOKEN_TYPE = 'password_reset_otp';

async function verifyOTP(req, res, next) {
  try {
    const { userId, otp: inputOTP } = req.body;

    if (!userId || !inputOTP) {
      return res.status(400).json({
        status: false,
        error: "User ID and OTP are required",
        message: null,
      });
    }

    // Get user from database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        status: false,
        error: "User not found",
        message: null,
      });
    }

    // Check token type stored in database
    const storedTokenType = user.auth?.access_token?.token_type;
    
    if (storedTokenType !== EXPECTED_TOKEN_TYPE) {
      return res.status(400).json({
        status: false,
        error: "Invalid token type",
        message: `Expected token type '${EXPECTED_TOKEN_TYPE}', but found '${storedTokenType || 'none'}'. Please request a new OTP.`
      });
    }

    // Check if OTP exists and not expired - use access_token.token for OTP storage
    const storedOTP = user.auth?.access_token?.token;
    const otpExpiry = user.auth?.access_token?.expires_at;

    if (!storedOTP) {
      return res.status(400).json({
        status: false,
        error: "OTP expired or not found",
        message: "Please request a new OTP."
      });
    }

    // Check if OTP has expired
    if (otpExpiry && new Date() > new Date(otpExpiry)) {
      // Clear expired OTP
      await User.findByIdAndUpdate(userId, {
        $set: {
          "auth.access_token.token": null,
          "auth.access_token.token_type": null,
          "auth.access_token.expires_at": null,
        },
      });

      return res.status(400).json({
        status: false,
        error: "OTP has expired",
        message: "Please request a new OTP."
      });
    }

    // Validate OTP (compare hashed values)
    const hashMatch = await tokenUtil.compareToken(inputOTP.toString(), storedOTP);

    if (!hashMatch) {
      return res.status(400).json({
        status: false,
        error: "Invalid OTP",
        message: "The OTP you entered is incorrect."
      });
    }

    // OTP valid - clear it from database (one-time use)
    await User.findByIdAndUpdate(userId, {
      $set: {
        "auth.access_token.token": null,
        "auth.access_token.token_type": null,
        "auth.access_token.expires_at": null,
      },
    });

    // Generate a temporary token for password change (valid for 5 minutes)
    const tempToken = otp.generateOTP(5); // 5-char temp token

    // Hash the temp token for storage
    const hashedTempToken = await tokenUtil.hashTokenLoginToken(tempToken);

    // Store temp token in user document with expiry
    const tempTokenExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await User.findByIdAndUpdate(userId, {
      $set: {
        "auth.access_token.token": hashedTempToken,
        "auth.access_token.token_type": "password_reset_temp",
        "auth.access_token.expires_at": tempTokenExpiry,
      },
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: "OTP verified. You can now reset your password.",
      data: {
        tempToken,
        userId,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = verifyOTP;
