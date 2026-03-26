/**
 * Logout Controller
 * Handles user logout and token invalidation
 */

const jwt = require("../../../utilities/jwt");
const User = require("../../../models/user");

/**
 * POST /auth/logout
 * Invalidate user's JWT token
 */
async function logout(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(200).json({
                status: true,
                error: null,
                message: "Logged out successfully",
            });
        }

        // Extract token
        const token = jwt.extractToken(authHeader);

        if (token) {
            // Decode token to get userId
            const decoded = jwt.decodeToken(token);

            if (decoded && decoded.userId) {
                // Increment token version to invalidate all existing tokens
                await User.findByIdAndUpdate(decoded.userId, {
                    $inc: { "auth.token_version": 1 },
                    $set: {
                        "auth.access_token": null
                    }
                });
            }
        }

        return res.status(200).json({
            status: true,
            error: null,
            message: "Logged out successfully",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /auth/logout/all
 * Logout from all devices (invalidate all tokens for user)
 */
async function logoutAll(req, res, next) {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                status: false,
                error: "User ID is required",
                message: null,
            });
        }

        // Increment token version to invalidate all tokens for user
        await User.findByIdAndUpdate(userId, {
            $inc: { "auth.token_version": 1 },
            $set: {
                "auth.access_token": null
            }
        });

        return res.status(200).json({
            status: true,
            error: null,
            message: "Logged out from all devices",
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    logout,
    logoutAll,
};
