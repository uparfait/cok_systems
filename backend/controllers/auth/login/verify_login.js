/**
 * Verify Login Controller
 * Verifies the TOTP token and returns JWT tokens
 */

const jwt = require("../../../utilities/jwt");
const totp = require("../../../utilities/totp");
const User = require("../../../models/user");
const department = require("../../../models/department");

// Import audit logging
const { logAuditEvent } = require("../../../middlewares/audit");

async function verifyLogin(req, res, next) {
    try {
        const { userId: userIdFromBody, otp, otpToken } = req.body;
        const userId = userIdFromBody;

        if (!userId) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "User ID and TOTP are required",
                error: "Please provide userId and TOTP"
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

        // Get stored TOTP secret from database
        const storedSecret = user.twofa_secret || user.auth?.access_token?.token;

        if (!storedSecret) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "No TOTP secret found",
                error: "Please contact administrator or reset your 2FA setup."
            });
        }

        // Check token type
        const storedTokenType = user.auth?.access_token?.token_type;
        
        if (storedTokenType !== "login_totp" && storedTokenType !== "first_login_totp" && storedTokenType !== "2fa_setup") {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid token type",
                error: "Please try logging in again."
            });
        }

        // Verify TOTP token
        const hashMatch = await totp.verifyTOTPToken(otp.toString(), storedSecret);

        if (!hashMatch.valid) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid TOTP",
                error: "Please check your authenticator app and try again"
            });
        }

        const updateData = {
            auth: {
                access_token: {
                    token: null,
                    token_type: null,
                    expires_at: null
                }
            }
        };

        if (storedTokenType === "2fa_setup") {
            updateData.twofa_secret = storedSecret;
        }

        // Clear the OTP from database (one-time use for this login session)
        await User.findByIdAndUpdate(userId, {
            $set: updateData
        });

        // Get user role and permissions from database
        const userRole = user.roles?.role_name || 'user';
        const userPermissions = user.roles?.permissions || [];

        // Create JWT tokens for client to use in future requests
        const payload = {
            userId: user._id.toString(),
            email: user.email,
            fullName: user.full_name,
            role: userRole,
            permissions: userPermissions
        };

        const accessToken = jwt.generateAccessToken(payload);
        const refreshToken = jwt.generateRefreshToken({ userId: user._id.toString() });

        // Log successful login
        await logAuditEvent('LOGIN', `User logged in successfully via TOTP: ${user.email}`, req, {
            resource: 'auth',
            resource_id: user._id.toString(),
            status_code: 200,
            metadata: {
                email: user.email,
                two_fa_used: true
            }
        });

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
