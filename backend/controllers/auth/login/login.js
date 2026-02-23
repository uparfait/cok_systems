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
    // const user = await User.findOne({ email: userEmail });
    // const isValidPassword = await bcrypt.compare(password, user.password);

    // For now, simulate user lookup (replace with actual database query)
    const user = {
      _id: "user_id_placeholder",
      email: userEmail,
      password: "hashed_password_placeholder", // Would be from DB
      role: "system_admin",
      requires2FA: true,
    };

    if (!user) {
      return res.status(401).json({
        status: false,
        error: "Invalid credentials",
        message: null,
      });
    }

    // Generate OTP for 2FA
    const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();

    // Store OTP in Redis with 5-minute TTL
    const otpKey = otp.getOTPKey("login", user._id);
    //await redis.storeOTP(otpKey, otpCode, otp.OTP_EXPIRY_SECONDS);

    // Send OTP via email
    const sent = await email.sendOTPEmail(userEmail, otpCode || 1234, "login");
    const hashedToken = await tokenUtil.hashTokenLoginToken(otpCode.toString());

    const prepare_token_fordb = {
      access_token: {
        token_type: "login_otp",
        token: hashedToken,
      },
    };

    // Store hashed token in user document in database (for OTP verification later)
    
    
    // await User.findByIdAndUpdate(user._id, {
    //   $set: {
    //     "auth.access_token": prepare_token_fordb
    //   },
    // });

    console.log(
      `Generated OTP for user ${userEmail}: ${otpCode} (hashed: ${hashedToken}, expires in 5 mins)`,
    );
    ``;

    console.log(
      `OTP for user ${userEmail}: ${otpCode} (sent: ${JSON.stringify(sent)})`,
    );
    console.log(
      `Generated OTP for user ${userEmail}: ${otpCode} (hashed: ${hashedToken}, expires at: ${expiresAt})`,
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
