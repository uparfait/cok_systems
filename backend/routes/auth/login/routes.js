/**
 * Login Routes
 * Handles user login with OTP 2FA
 */

const Router = require('express').Router();
const jwt = require('../../../utilities/jwt');
const otp = require('../../../utilities/otp');
const email = require('../../../utilities/email');
const redis = require('../../../utilities/redis');

/**
 * POST /auth/login
 * Step 1: Verify credentials, send OTP for 2FA
 */
Router.post('/', async (req, res, next) => {
    try {
        const { email: userEmail, password } = req.body;

        // Validate input
        if (!userEmail || !password) {
            return res.status(400).json({
                status: false,
                error: 'Email and password are required',
                message: null
            });
        }

        // TODO: Check user in database
        // const user = await User.findOne({ email: userEmail });
        // const isValidPassword = await bcrypt.compare(password, user.password);

        // For now, simulate user lookup (replace with actual database query)
        const user = {
            _id: 'user_id_placeholder',
            email: userEmail,
            password: 'hashed_password_placeholder', // Would be from DB
            role: 'system_admin',
            requires2FA: true
        };

        if (!user) {
            return res.status(401).json({
                status: false,
                error: 'Invalid credentials',
                message: null
            });
        }

        // Generate OTP for 2FA
        const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();
        
        // Store OTP in Redis with 5-minute TTL
        const otpKey = otp.getOTPKey('login', user._id);
        await redis.storeOTP(otpKey, otpCode, otp.OTP_EXPIRY_SECONDS);

        // Send OTP via email
        await email.sendOTPEmail(userEmail, otpCode, 'login');

        return res.status(200).json({
            status: true,
            error: null,
            message: 'OTP sent to your email. Please verify to complete login.',
            data: {
                requiresOTP: true,
                userId: user._id
            }
        });

    } catch (error) {
        next(error);
    }
});

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

        // Get stored OTP from Redis
        const otpKey = otp.getOTPKey('login', userId);
        const storedOTP = await redis.getOTP(otpKey);

        if (!storedOTP) {
            return res.status(400).json({
                status: false,
                error: 'OTP expired or not found. Please request a new one.',
                message: null
            });
        }

        // Validate OTP
        const validation = otp.validateOTP(inputOTP, storedOTP, new Date(Date.now() + otp.OTP_EXPIRY_SECONDS * 1000));
        
        if (!validation.valid) {
            return res.status(400).json({
                status: false,
                error: validation.error,
                message: null
            });
        }

        // OTP valid - delete it from Redis (one-time use)
        await redis.deleteOTP(otpKey);

        // TODO: Get user from database
        const user = {
            _id: userId,
            email: 'user@example.com',
            role: 'system_admin'
        };

        // Generate JWT tokens
        const tokens = jwt.generateTokens({
            userId: user._id,
            email: user.email,
            role: user.role
        });

        return res.status(200).json({
            status: true,
            error: null,
            message: 'Login successful',
            data: {
                user: {
                    userId: user._id,
                    email: user.email,
                    role: user.role
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

        // Store in Redis (overwrites old OTP if exists)
        const otpKey = otp.getOTPKey('login', userId);
        await redis.storeOTP(otpKey, otpCode, otp.OTP_EXPIRY_SECONDS);

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
