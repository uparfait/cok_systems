/**
 * Verify Login Controller
 * Only verifies the OTP JWT token - does NOT perform login
 * Returns simple verification status
 */

const jwt = require("../../../utilities/jwt");
const User = require("../../../models/user");

async function verifyLogin(req, res, next) {
    try {
        const { userId, otpToken } = req.body;

        if (!userId || !otpToken) {
            return res.status(400).json({
                status: false,
                error: 'User ID and OTP token are required',
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

        // Check if account is locked
        if (user.access_control?.is_locked) {
            return res.status(403).json({
                status: false,
                error: 'Account is locked',
                message: "Account locked. Please contact administrator."
            });
        }

        // Verify the OTP JWT token
        const verification = jwt.verifyAccessToken(otpToken);

        if (!verification.valid) {
            return res.status(400).json({
                status: false,
                error: 'Invalid or expired OTP',
                message: 'Please request a new OTP.'
            });
        }

        // Token is valid - extract the data from payload
        const decoded = verification.decoded;

        // Verify this token is for the correct user
        if (decoded.userId !== userId) {
            return res.status(400).json({
                status: false,
                error: 'Invalid OTP',
                message: 'OTP does not match this user'
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

        // Return simple verification success - NO login tokens
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
