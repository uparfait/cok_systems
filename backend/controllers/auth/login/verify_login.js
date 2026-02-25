/**
 * Verify Login Controller
 * Verifies the OTP using tokenUtil.compareToken
 * Accepts either 'otp' (plain OTP) or 'otpToken' (JWT) from user
 */

const jwt = require("../../../utilities/jwt");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");

async function verifyLogin(req, res, next) {
    try {
        // Accept either otp or otpToken from user
        const { userId, otp, otpToken } = req.body;
        
        // Use whichever was provided
        const inputOTP = otp || otpToken;

        if (!userId || !inputOTP) {
            return res.status(400).json({
                status: false,
                error: 'User ID and OTP are required',
                message: 'Please provide userId and either otp or otpToken'
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

        // Check if account is locked
        if (user.access_control?.is_locked) {
            return res.status(403).json({
                status: false,
                error: 'Account is locked',
                message: "Account locked. Please contact administrator."
            });
        }

        // Get stored OTP from database
        const storedOTP = user.auth?.access_token?.token;
        const storedTokenType = user.auth?.access_token?.token_type;

        if (!storedOTP) {
            return res.status(400).json({
                status: false,
                error: 'No OTP found',
                message: 'Please request a new OTP'
            });
        }

        // Check if OTP has expired
        const expiresAt = user.auth?.access_token?.expires_at;
        if (expiresAt && new Date(expiresAt) < new Date()) {
            // Clear expired OTP
            await User.findByIdAndUpdate(userId, {
                $set: {
                    'auth.access_token.token': null,
                    'auth.access_token.token_type': null,
                    'auth.access_token.expires_at': null
                }
            });
            
            return res.status(400).json({
                status: false,
                error: 'OTP expired',
                message: 'Please request a new OTP'
            });
        }

        // Use tokenUtil.compareToken to verify OTP
        // This works for both plain OTP and JWT tokens
        const hashMatch = await tokenUtil.compareToken(inputOTP.toString(), storedOTP);

        if (!hashMatch) {
            return res.status(400).json({
                status: false,
                error: 'Invalid OTP',
                message: 'Please check the OTP and try again'
            });
        }

        // Clear the OTP from database (one-time use)
        await User.findByIdAndUpdate(userId, {
            $set: {
                'auth.access_token.token': null,
                'auth.access_token.token_type': null,
                'auth.access_token.expires_at': null
            }
        });

        // Return verification success - NO login tokens (client should call /login after verification)
        return res.status(200).json({
            status: true,
            error: null,
            message: 'OTP verified successfully',
            data: {
                verified: true,
                userId: user._id,
                email: user.email
            }
        });

    } catch (error) {
        next(error);
    }
}

module.exports = verifyLogin;
