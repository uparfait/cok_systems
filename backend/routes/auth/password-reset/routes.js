/**
 * Password Reset Routes
 * Handles password reset with OTP verification
 */

const Router = require('express').Router();
const otp = require('../../../utilities/otp');
const email = require('../../../utilities/email');
const redis = require('../../../utilities/redis');
const passwordValidator = require('../../../utilities/password');

/**
 * POST /auth/password-reset
 * Step 1: Request password reset - send OTP to email
 */
Router.post('/', async (req, res, next) => {
    try {
        const { email: userEmail } = req.body;

        if (!userEmail) {
            return res.status(400).json({
                status: false,
                error: 'Email is required',
                message: null
            });
        }

        // TODO: Check if user exists in database
        // const user = await User.findOne({ email: userEmail });
        
        // Simulate user lookup (replace with actual database query)
        const user = {
            _id: 'user_id_placeholder',
            email: userEmail
        };

        if (!user) {
            // Don't reveal if email exists or not
            return res.status(200).json({
                status: true,
                error: null,
                message: 'If the email exists, an OTP will be sent'
            });
        }

        // Generate 5-digit OTP
        const { otp: otpCode, expiresAt } = otp.generateOTPWithExpiry();
        
        // Store OTP in Redis with 5-minute TTL
        const otpKey = otp.getOTPKey('reset', user._id);
        await redis.storeOTP(otpKey, otpCode, otp.OTP_EXPIRY_SECONDS);

        // Send OTP via email
        await email.sendOTPEmail(userEmail, otpCode, 'password_reset');

        return res.status(200).json({
            status: true,
            error: null,
            message: 'OTP sent to your email for password reset',
            data: {
                userId: user._id
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /auth/password-reset/verify
 * Step 2: Verify OTP and allow password change
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
        const otpKey = otp.getOTPKey('reset', userId);
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

        // OTP valid - delete it (one-time use)
        await redis.deleteOTP(otpKey);

        // Generate a temporary token for password change (valid for 10 minutes)
        const tempToken = otp.generateOTP(5); // 10-char temp token
        const tempTokenKey = `temp_reset:${userId}`;
        await redis.setWithTTL(tempTokenKey, tempToken, 500); // 5 minutes

        return res.status(200).json({
            status: true,
            error: null,
            message: 'OTP verified. You can now reset your password.',
            data: {
                tempToken,
                userId
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /auth/password-reset/reset
 * Step 3: Set new password with temp token
 */
Router.post('/reset', async (req, res, next) => {
    try {
        const { userId, tempToken, newPassword } = req.body;

        if (!userId || !tempToken || !newPassword) {
            return res.status(400).json({
                status: false,
                error: 'User ID, temp token, and new password are required',
                message: null
            });
        }

        // Validate password policy
        const passwordValidation = passwordValidator.validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                status: false,
                error: passwordValidation.errors.join(', '),
                message: null
            });
        }

        // Verify temp token
        const tempTokenKey = `temp_reset:${userId}`;
        const storedToken = await redis.get(tempTokenKey);

        if (!storedToken || storedToken !== tempToken) {
            return res.status(400).json({
                status: false,
                error: 'Invalid or expired reset token',
                message: null
            });
        }

        // TODO: Hash password and update in database
        // const hashedPassword = await bcrypt.hash(newPassword, 10);
        // await User.findByIdAndUpdate(userId, { password: hashedPassword });

        // Delete temp token
        await redis.remove(tempTokenKey);

        // Send confirmation email
        // await email.sendPasswordChangedEmail(userEmail, userName);

        return res.status(200).json({
            status: true,
            error: null,
            message: 'Password reset successfully'
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /auth/password-reset/resend
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

        // Generate new 5-digit OTP
        const { otp: otpCode } = otp.generateOTPWithExpiry();

        // Store in Redis (overwrites old OTP)
        const otpKey = otp.getOTPKey('reset', userId);
        await redis.storeOTP(otpKey, otpCode, otp.OTP_EXPIRY_SECONDS);

        // Send new OTP via email
        await email.sendOTPEmail(userEmail, otpCode, 'password_reset');

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
