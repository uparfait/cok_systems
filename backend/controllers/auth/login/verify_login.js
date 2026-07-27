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

const MAX_TOTP_ATTEMPTS = 5;
const TOTP_LOCKOUT_MINUTES = 15;
const TOTP_SETUP_TTL_MINUTES = 15;

async function verifyLogin(req, res, next) {
    try {
        const { userId: userIdFromBody, otp } = req.body;
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

        // Check if 2FA is disabled
        if (user.is_2FA_disabled) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "2FA is disabled",
                error: "This account does not require TOTP verification."
            });
        }

        // Get stored TOTP secret from twofa_setup (setup flow) or twofa_secret (normal login)
        // IMPORTANT: For setup verification, prioritize twofa_setup.secret over twofa_secret
        // because twofa_secret may contain an old value from previous code versions
        const storedSecret = user.twofa_setup?.secret || user.twofa_secret;

        if (!storedSecret) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "No TOTP secret found",
                error: "Please set up two-factor authentication first."
            });
        }

        // Check if this is a 2FA setup verification
        const isSetupVerification = !!user.twofa_setup?.secret && !user.twofa_secret;
        
        if (isSetupVerification) {
            // Check TOTP setup expiry
            if (totp.isTOTPSetupExpired(user.twofa_setup?.expires_at, TOTP_SETUP_TTL_MINUTES)) {
                // Clear expired setup
                await User.findByIdAndUpdate(userId, {
                    $set: {
                        twofa_setup: {
                            secret: null,
                            qr_code: null,
                            otpauth_url: null,
                            created_at: null,
                            expires_at: null,
                            verified: false
                        }
                    }
                });

                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "TOTP setup expired",
                    error: "Your TOTP setup session has expired. Please try logging in again to generate a new QR code."
                });
            }
        }

        // Check TOTP verification lockout
        const verification = user.twofa_verification || {};
        const now = new Date();
        
        if (verification.locked_until && now < new Date(verification.locked_until)) {
            const remainingMinutes = Math.ceil((new Date(verification.locked_until) - now) / (1000 * 60));
            return res.status(403).json({
                success: false,
                type: "warning",
                message: "Too many failed attempts",
                error: `Account locked for ${remainingMinutes} minutes due to too many failed TOTP attempts. Please try again later.`
            });
        }

        // Verify TOTP token
        const hashMatch = totp.verifyTOTPToken(otp.toString(), storedSecret);

        if (!hashMatch.valid) {
            // Increment failed attempts
            const attempts = (verification.attempts || 0) + 1;
        const updateData = {
                "twofa_verification.attempts": attempts,
                "twofa_verification.last_attempt": now
            };

            // Lock account if max attempts reached
            if (attempts >= MAX_TOTP_ATTEMPTS) {
                const lockedUntil = new Date(now.getTime() + TOTP_LOCKOUT_MINUTES * 60 * 1000);
                updateData["twofa_verification.locked_until"] = lockedUntil;
                
                // Also lock the user account
                updateData["access_control.is_locked"] = true;
                updateData["access_control.reason"] = `Account locked due to ${MAX_TOTP_ATTEMPTS} failed TOTP verification attempts`;

                await logAuditEvent('SECURITY', `Account locked due to ${MAX_TOTP_ATTEMPTS} failed TOTP attempts: ${user.email}`, req, {
                    resource: 'auth',
                    resource_id: user._id.toString(),
                    status_code: 403,
                    metadata: {
                        email: user.email,
                        reason: 'too_many_totp_failed_attempts',
                        attempts: attempts
                    }
                });
            } else {
                await logAuditEvent('SECURITY', `Failed TOTP attempt ${attempts}/${MAX_TOTP_ATTEMPTS} for: ${user.email}`, req, {
                    resource: 'auth',
                    resource_id: user._id.toString(),
                    status_code: 400,
                    metadata: {
                        email: user.email,
                        attempts: attempts,
                        remaining: MAX_TOTP_ATTEMPTS - attempts
                    }
                });
            }

            await User.findByIdAndUpdate(userId, { $set: updateData });

            return res.status(400).json({
                success: false,
                type: "warning",
                message: attempts >= MAX_TOTP_ATTEMPTS ? "Account locked" : "Invalid TOTP",
                error: attempts >= MAX_TOTP_ATTEMPTS 
                    ? `Account locked for ${TOTP_LOCKOUT_MINUTES} minutes due to too many failed attempts.`
                    : `Invalid TOTP. You have ${MAX_TOTP_ATTEMPTS - attempts} attempts remaining.`
            });
        }

        // TOTP is valid - reset attempts and proceed
        const updateData = {
            "twofa_verification.attempts": 0,
            "twofa_verification.last_attempt": null,
            "twofa_verification.locked_until": null
        };

        // If this was a setup verification, save the secret permanently and clear setup data
        if (isSetupVerification) {
            updateData.twofa_secret = storedSecret;
            updateData.twofa_setup = {
                secret: null,
                qr_code: null,
                otpauth_url: null,
                created_at: null,
                expires_at: null,
                verified: true
            };
        }

        // Clear auth tokens - handle case where auth.access_token might be null
        // MongoDB cannot create nested fields inside a null parent element
        if (user.auth?.access_token === null) {
            await User.findByIdAndUpdate(userId, { $set: { "auth.access_token": {} } });
        }
        await User.findByIdAndUpdate(userId, { $set: updateData });

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
                two_fa_used: true,
                was_setup: isSetupVerification
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
