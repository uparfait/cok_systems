const jwt = require("../../../utilities/jwt");
const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

async function login(req, res, next) {
  try {
    let { email: userEmail = null, password = null } = req.body || {};

    userEmail = userEmail ? userEmail.trim().toLowerCase() : null;

    // Validate input
    if (!userEmail || !password) {
      return res.status(400).json({
        status: false,
        error: "Email and password are required",
        message: null,
      });
    }

    // TODO: Check user in database
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(401).json({
        status: false,
        error: "Invalid credentials",
        message: null,
      });
    }

    // Generate OTP for 2FA
    const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();

    // Hash the OTP for database storage
    const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());

    // Calculate expiry time
    const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

    // Store OTP in database (instead of Redis)
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "auth.otp": hashedOTP,
        "auth.otp_expiry": otpExpiry
      }
    });

    // Send OTP via email
    const sent = await email.sendOTPEmail(userEmail, otpCode || 1234, "login");

    console.log(
      `Generated OTP for user ${userEmail}: ${otpCode} (hashed: ${hashedOTP}, expires in 5 mins)`,
    );

    console.log(
      `OTP for user ${userEmail}: ${otpCode} (sent: ${JSON.stringify(sent)})`,
    );
    console.log(
      `Generated OTP for user ${userEmail}: ${otpCode} (expires at: ${expiresAt})`,
    );

    return res.status(200).json({
      status: true,
      error: null,
      message: "OTP sent to your email. Please verify to complete login.",
      data: {
        requiresOTP: true,
        userId: user._id,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = login;
