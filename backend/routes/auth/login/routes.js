/**
 * Login Routes
 * Handles user login with OTP 2FA
 */

const Router = require('express').Router();
const jwt = require('../../../utilities/jwt');
const otp = require('../../../utilities/otp');
const email = require('../../../utilities/email');
const tokenUtil = require('../../../utilities/token');
const User = require('../../../models/user');
const loginController = require('../../../controllers/auth/login/login');
const passwordResetController = require('../../../controllers/auth/password-reset/password-reset');
const logoutController = require('../../../controllers/auth/logout/logout');

/**
 * POST /auth/login
 * Step 1: Verify credentials, send OTP for 2FA
 */
Router.post('/', loginController);

/**
 * POST /auth/login/verify
 * Step 2: Verify OTP, issue JWT token
 */
Router.post('/verify', async (req, res, next) => {
    try {
        const { userId, otp: inputOTP } = req.body;

        if (!userId || !inputOTP) {
            return res.status(400).json({
                status: false,
                error: 'User ID and OTP are required',
                message: null
            });
        }

        // Get user from database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({
                status: false,
                error: 'User not found',
                message: null
            });
        }

        // Get stored OTP from database
        const storedOTP = user.auth?.otp;
        const otpExpiry = user.auth?.otp_expiry;

        if (!storedOTP) {
            return res.status(400).json({
                status: false,
                error: 'OTP expired or not found. Please request a new one.',
                message: null
            });
        }

        // Check if OTP has expired
        if (otpExpiry && new Date() > new Date(otpExpiry)) {
            // Clear expired OTP
            await User.findByIdAndUpdate(userId, {
                $set: {
                    'auth.otp': null,
                    'auth.otp_expiry': null
                }
            });

            return res.status(400).json({
                status: false,
                error: 'OTP has expired. Please request a new one.',
                message: null
            });
        }

        // Validate OTP (compare hashed values)
        const hashMatch = await tokenUtil.compareToken(inputOTP.toString(), storedOTP);

        if (!hashMatch) {
            return res.status(400).json({
                status: false,
                error: 'Invalid OTP',
                message: null
            });
        }

        // OTP valid - clear it from database (one-time use)
        await User.findByIdAndUpdate(userId, {
            $set: {
                'auth.otp': null,
                'auth.otp_expiry': null
            }
        });

        // Generate JWT tokens
        const tokens = jwt.generateTokens({
            userId: user._id,
            email: user.email,
            role: user.roles?.role_name || 'system_admin'
        });

        // Store token in user document in database
        await User.findByIdAndUpdate(userId, {
            $set: {
                'auth.access_token': tokens.accessToken,
                'auth.token_version': 1,
                'auth.last_token_issued_at': new Date()
            }
        });

        return res.status(200).json({
            status: true,
            error: null,
            message: 'Login successful',
            data: {
                user: {
                    userId: user._id,
                    email: user.email,
                    role: user.roles?.role_name || 'system_admin'
                },
                tokens
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /auth/login/resend
 * Resend OTP if previous one expired
 */
Router.post('/resend', async (req, res, next) => {
    try {
        const { userId, email: userEmail } = req.body;

        if (!userId || !userEmail) {
            return res.status(400).json({
                status: false,
                error: 'User ID and email are required',
                message: null
            });
        }

        // Generate new OTP
        const { otp: otpCode } = otp.generateOTPWithExpiry();

        // Hash the OTP for database storage
        const hashedOTP = await tokenUtil.hashTokenLoginToken(otpCode.toString());

        // Calculate expiry time
        const otpExpiry = new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000);

        // Store in database (overwrites old OTP if exists)
        await User.findByIdAndUpdate(userId, {
            $set: {
                'auth.otp': hashedOTP,
                'auth.otp_expiry': otpExpiry
            }
        });

        // Send new OTP via email
        await email.sendOTPEmail(userEmail, otpCode, 'login');

        return res.status(200).json({
            status: true,
            error: null,
            message: 'New OTP sent to your email'
        });

    } catch (error) {
        next(error);
    }
});

module.exports = Router;
