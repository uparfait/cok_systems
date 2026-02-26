/**
 * Verify Login Controller
 * Verifies the OTP using tokenUtil.compareToken
 * Uses Bearer token from Authorization header or body parameters
 */

const jwt = require("../../../utilities/jwt");
const tokenUtil = require("../../../utilities/token");
const User = require("../../../models/user");
const department = require("../../../models/department");

async function verifyLogin(req, res, next) {
    try {

        let inputOTP;
      
        const { userId: userIdFromBody, otp, otpToken } = req.body;
        
        // Use body params if header not provided
        if (!inputOTP && (otp || otpToken)) {
            inputOTP = otp || otpToken;
        }
        
        // Use userId from body
        const userId =  userIdFromBody;

        if (!userId || !inputOTP) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "User ID and OTP are required",
                error: "Please provide userId and OTP"
            });
        }

        // Get user from database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                type: "warning",
                message: "User not found",
                error: "User associated with token no longer exists"
            });
        }

     

        // Check if account is activated
        if (!user.is_account_activated) {
            return res.status(403).json({
                success: false,
                type: "warning",
                message: "Account not activated",
                error: "Please activate your account first"
            });
        }

        // Check if account is locked
        if (user.access_control?.is_locked) {
            return res.status(403).json({
                success: false,
                type: "warning",
                message: "Account is locked",
                error: user.access_control?.reason || "Your account has been locked. Please contact administrator."
            });
        }

        // Get stored OTP from database
        const storedOTP = user.auth?.access_token?.token;

        if (!storedOTP) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "No OTP found",
                error: "Please request a new OTP"
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
                success: false,
                type: "warning",
                message: "OTP expired",
                error: "Please request a new OTP"
            });
        }

        // Use tokenUtil.compareToken to verify OTP
        const hashMatch = await tokenUtil.compareToken(inputOTP.toString(), storedOTP);

        if (!hashMatch) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid OTP",
                error: "Please check the OTP and try again"
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

        // Get user role and permissions from database
        const userRole = user.roles?.role_name || 'user';
        const userPermissions = user.roles?.permissions || [];

        // Create JWT tokens for client to use in future requests
        // Using jwt utility functions
        const payload = {
            userId: user._id.toString(),
            email: user.email,
            fullName: user.full_name,
            role: userRole,
            permissions: userPermissions
        };

        const accessToken = jwt.generateAccessToken(payload);
        const refreshToken = jwt.generateRefreshToken({ userId: user._id.toString() });

        // Return verification success with tokens
        return res.status(200).json({
            success: true,
            type: "success",
            message: "Login successful",
            data: {
                verified: true,
                userId: user._id,
                email: user.email,
                fullName: user.full_name,
                role: userRole,
                telephone: user.telephone,
                department_name: user.department_name,
                department_id: user.department_id,
                permissions: userPermissions,
                accessToken: accessToken,
                refreshToken: refreshToken
            }
        });

    } catch (error) {
        console.error("Verify login error:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Verification failed",
            error: error.message
        });
    }
}

module.exports = verifyLogin;
