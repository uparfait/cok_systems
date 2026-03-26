/**
 * Password Reset Controller
 * Handles password reset with OTP verification (stored in database)
 */

const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

const passwordValidator = (password) => {
    const errors = [];
    if (password.length < 8) {
        errors.push("Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
        errors.push("Password must contain at least one digit");
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push("Password must contain at least one special character");
    }
    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * POST /auth/password-reset
 * Step 1: Request password reset - send OTP to email
 */
async function requestReset(req, res, next) {
    try {
        const { email: userEmail } = req.body;

        if (!userEmail) {
            return res.status(400).json({
                status: false,
                error: "Email is required",
                message: null,
            });
        }

        // TODO: Check if user exists in database
        const user = await User.findOne({ email: userEmail });

        if (!user) {
            // Don't reveal if email exists or not
            return res.status(200).json({
                status: true,
                error: null,
                message: `User with this email ${userEmail} does not exist. Please check and try again.`,
            });
        }


        // Generate 5-digit OTP
        const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();

        // Hash the OTP for database storage
        const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());

        // Calculate expiry time
        const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);


        // check if user has auth attribute, if not create it and save data accordingly

        if (!user.auth) {
            user.auth = {};
            user.auth.access_token = {}
            user.auth.access_token.token_type = "password_reset_otp";
            user.auth.access_token.token = hashedOTP;
            await user.save();
        } else {
            // Store OTP in database (instead of Redis)
            await User.findByIdAndUpdate(user._id, {
                $set: {
                    "auth.access_token.token_type": "password_reset_otp",
                    "auth.access_token.token": hashedOTP,
                    "auth.otp_expiry": otpExpiry,
                },
            });
        }

        // Send OTP via email
        await email.sendOTPEmail(userEmail, otpCode, "password_reset");

        const updatedUser = await User.findOne({ email: userEmail });
        console.log("Updated user:", updatedUser);

        return res.status(200).json({
            status: true,
            error: null,
            message: "OTP sent to your email for password reset",
            data: {
                userId: user._id,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /auth/password-reset/verify
 * Step 2: Verify OTP and allow password change
 */
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
        //send otp to email
        await email.sendOTPEmail(user.email, inputOTP, "password_reset");
        // Check token type stored in database
        const storedTokenType = user.auth?.access_token?.token_type;

        // Check if OTP exists and not expired
        const storedOTP = user.auth?.otp;
        const otpExpiry = user.auth?.otp_expiry;

        if (!storedOTP) {
            return res.status(400).json({
                status: false,
                error: "OTP expired or not found. Please request a new one.",
                message: null,
            });
        }

        // Check if OTP has expired
        if (otpExpiry && new Date() > new Date(otpExpiry)) {
            // Clear expired OTP
            await User.findByIdAndUpdate(userId, {
                $set: {
                    "auth.otp": null,
                    "auth.otp_expiry": null,
                },
            });

            return res.status(400).json({
                status: false,
                error: "OTP has expired. Please request a new one.",
                message: null,
            });
        }

        // Validate OTP (compare hashed values)
        const hashMatch = await tokenUtil.compareToken(inputOTP.toString(), storedOTP);

        if (!hashMatch) {
            return res.status(400).json({
                status: false,
                error: "Invalid OTP",
                message: null,
            });
        }

        // OTP valid - clear it from database (one-time use)
        await User.findByIdAndUpdate(userId, {
            $set: {
                "auth.otp": null,
                "auth.otp_expiry": null,
            },
        });

        // Generate a temporary token for password change (valid for 10 minutes)
        const tempToken = otp.generateOTP(5); // 10-char temp token

        // Hash the temp token for storage
        const hashedTempToken = await tokenUtil.hashTokenLoginToken(tempToken);

        // Store temp token in user document with expiry
        const tempTokenExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await User.findByIdAndUpdate(userId, {
            $set: {
                "auth.access_token": hashedTempToken,
                "auth.otp_expiry": tempTokenExpiry,
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

/**
 * POST /auth/password-reset/reset
 * Step 3: Set new password with temp token
 */
async function resetPassword(req, res, next) {
    try {
        const { userId, tempToken, asswnewPord } = req.body;

        if (!userId || !tempToken || !newPassword) {
            return res.status(400).json({
                status: false,
                error: "User ID, temp token, and new password are required",
                message: null,
            });
        }

        // Validate password policy
        const passwordValidation = passwordValidator(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                status: false,
                error: passwordValidation.errors.join(", "),
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

        // Verify temp token from database (access_token is now a simple string)
        const storedToken = user.auth?.access_token;
        const tokenExpiry = user.auth?.otp_expiry;

        if (!storedToken) {
            return res.status(400).json({
                status: false,
                error: "Invalid or expired reset token",
                message: null,
            });
        }

        // Check if token has expired
        if (tokenExpiry && new Date() > new Date(tokenExpiry)) {
            await User.findByIdAndUpdate(userId, {
                $set: {
                    "auth.access_token": null,
                    "auth.otp_expiry": null,
                },
            });

            return res.status(400).json({
                status: false,
                error: "Reset token has expired. Please request a new one.",
                message: null,
            });
        }

        // Verify the temp token
        const hashMatch = await tokenUtil.compareToken(tempToken, storedToken);

        if (!hashMatch) {
            return res.status(400).json({
                status: false,
                error: "Invalid or expired reset token",
                message: null,
            });
        }

        // TODO: Hash password and update in database
        // const hashedPassword = await bcrypt.hash(newPassword, 10);
        // await User.findByIdAndUpdate(userId, { password: hashedPassword });

        // Clear the reset token from user document
        await User.findByIdAndUpdate(userId, {
            $set: {
                "auth.access_token": null,
                "auth.otp_expiry": null,
            },
        });

        // Send confirmation email
        // await email.sendPasswordChangedEmail(userEmail, userName);

        return res.status(200).json({
            status: true,
            error: null,
            message: "Password reset successfully",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /auth/password-reset/resend
 * Resend OTP if previous one expired
 */
async function resendOTP(req, res, next) {
    try {
        const { userId, email: userEmail } = req.body;

        if (!userId || !userEmail) {
            return res.status(400).json({
                status: false,
                error: "User ID and email are required",
                message: null,
            });
        }

        // Generate new 5-digit OTP
        const { otp: otpCode } = otp.generateOTPWithExpiry();

        // Hash and store in database
        const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());
        const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

        if (!user.auth) {
            user.auth = {};
            user.auth.access_token = {}
            user.auth.access_token.token_type = "password_reset_otp";
            user.auth.access_token.token = hashedOTP;
            user.auth.access_token.expires_at = otpExpiry;
            await user.save();
        } else {
            await User.findByIdAndUpdate(userId, {
                $set: {
                    "auth.access_token.token_type": "password_reset_otp",
                    "auth.access_token.token": hashedOTP,
                    "auth.access_token.expires_at": otpExpiry,
                },
            });
        }

        // Send new OTP via email
        await email.sendOTPEmail(userEmail, otpCode, "password_reset");

        return res.status(200).json({
            status: true,
            error: null,
            message: "New OTP sent to your email",
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    requestReset,
    verifyOTP,
    resetPassword,
    resendOTP,
};
