/**
 * First-Time Login Controller
 * Handles account activation for users created by admin without password
 */

const bcrypt = require('bcrypt');
const otp = require("../../../utilities/otp");
const email = require("../../../utilities/email");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

const SALT_ROUNDS = 10;

// Password validation
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

// /**
//  * POST /auth/first-login/check
//  * Step 1: Check if email exists and account is not activated
//  */
async function checkEmail(req, res, next) {
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
                message: "No account found with this email. Please contact your administrator.",
            });
        }

        // Check if account is already activated
        if (user.is_account_activated) {
            return res.status(400).json({
                status: false,
                error: "Account already activated",
                message: "This account is already active. Please use the regular login.",
                data: {
                    alreadyActivated: true
                }
            });
        }

        // Check if user already has a password (should not for first-time login)
        if (user.password) {
            return res.status(400).json({
                status: false,
                error: "Account already has a password",
                message: "This account appears to be set up. Please use the regular login.",
            });
        }

        return res.status(200).json({
            status: true,
            error: null,
            message: "Account found. You can proceed with activation.",
            data: {
                userId: user._id,
                email: normalizedEmail,
                canActivate: true
            },
        });

    } catch (error) {
        next(error);
    }
}

/**
 * POST /auth/first-login/send-otp
 * Step 2: Send OTP to user's email for verification
 */
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

        // Check if account is already activated
        if (user.is_account_activated) {
            return res.status(400).json({
                status: false,
                error: "Account already activated",
                message: "This account is already active. Please use the regular login.",
            });
        }

        // Generate 5-digit OTP
        const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();

        // Hash the OTP for database storage
        const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());

        // Calculate expiry time
        const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

             console.log('User', await User.findById(user._id));

        await User.findByIdAndUpdate(user._id, {
            $set: {
                "auth.access_token.token_type": "first_login_otp",
                "auth.access_token.token": hashedOTP,
            },
        });
        // Send OTP via email
        await email.sendOTPEmail(normalizedEmail, otpCode, "first_login");

        console.log(
            `Generated OTP for first-time login ${normalizedEmail}: ${otpCode} (expires in 5 mins)`,
        );

        return res.status(200).json({
            status: true,
            error: null,
            message: "OTP sent to your email. Please verify to activate your account.",
            data: {
                userId: user._id,
                email: normalizedEmail,
            },
        });

    } catch (error) {
        next(error);
    }
}

/**
 * POST /auth/first-login/activate
 * Step 3: Verify OTP and create password
 */
async function activateAccount(req, res, next) {
    try {
        const { userId, otp: inputOTP, newPassword, confirmPassword } = req.body;

        // Validate input
        if (!userId || !inputOTP) {
            return res.status(400).json({
                status: false,
                error: "User ID and OTP are required",
                message: null,
            });
        }

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({
                status: false,
                error: "New password and confirmation are required",
                message: null,
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                status: false,
                error: "Passwords do not match",
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

        // Check if OTP exists and not expired
        const storedOTP = user.auth?.otp;
        const otpExpiry = user.auth?.otp_expiry;

        if (!storedOTP) {
            return res.status(400).json({
                status: false,
                error: "OTP expired or not found",
                message: "Please request a new OTP.",
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
                error: "OTP has expired",
                message: "Please request a new OTP.",
            });
        }

        // Validate OTP (compare hashed values)
        const hashMatch = await tokenUtil.compareToken(inputOTP.toString(), storedOTP);

        if (!hashMatch) {
            return res.status(400).json({
                status: false,
                error: "Invalid OTP",
                message: "Please enter the correct OTP sent to your email.",
            });
        }

        // OTP valid - clear it from database (one-time use)
        await User.findByIdAndUpdate(userId, {
            $set: {
                "auth.otp": null,
                "auth.otp_expiry": null,
            },
        });

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Update user with password and mark as activated
        await User.findByIdAndUpdate(userId, {
            $set: {
                password: hashedPassword,
                is_account_activated: true,
            },
        });

        // Send confirmation email
        try {
            await email.sendAccountActivatedEmail(user.email, user.full_name);
        } catch (emailError) {
            // Log email error but don't fail the activation
            console.error("Failed to send activation confirmation email:", emailError);
        }

        return res.status(200).json({
            status: true,
            error: null,
            message: "Account activated successfully! You can now login with your email and password.",
        });

    } catch (error) {
        next(error);
    }
}

/**
 * POST /auth/first-login/resend
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

        // Verify user exists and is not activated
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: false,
                error: "User not found",
                message: null,
            });
        }

        if (user.is_account_activated) {
            return res.status(400).json({
                status: false,
                error: "Account already activated",
                message: "This account is already active.",
            });
        }

        // Generate new 5-digit OTP
        const { otp: otpCode } = otp.generateOTPWithExpiry();

        // Hash and store in database
        const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());
        const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);
console.log('Generated new OTP for first-time login resend:', otpCode);


        // Send new OTP via email
        await email.sendOTPEmail(userEmail, otpCode, "first_login");

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
    checkEmail,
    sendOTP,
    activateAccount,
    resendOTP,
};
