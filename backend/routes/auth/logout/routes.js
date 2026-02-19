/**
 * Logout Routes
 * Handles user logout and token invalidation
 */

const Router = require('express').Router();
const jwt = require('../../../utilities/jwt');
const redis = require('../../../utilities/redis');

/**
 * POST /auth/logout
 * Invalidate user's JWT token
 */
Router.post('/', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(200).json({
                status: true,
                error: null,
                message: 'Logged out successfully'
            });
        }

        // Extract token
        const token = jwt.extractToken(authHeader);

        if (token) {
            // Decode token to get expiry
            const decoded = jwt.decodeToken(token);
            
            if (decoded && decoded.exp) {
                // Calculate TTL until token expires
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                
                if (ttl > 0) {
                    // Store token in Redis blacklist with remaining TTL
                    const blacklistKey = `blacklist:${token}`;
                    await redis.setWithTTL(blacklistKey, true, ttl);
                }
            }
        }

        return res.status(200).json({
            status: true,
            error: null,
            message: 'Logged out successfully'
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /auth/logout/all
 * Logout from all devices (invalidate all tokens for user)
 */
Router.post('/all', async (req, res, next) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                status: false,
                error: 'User ID is required',
                message: null
            });
        }

        // Store a flag in Redis to invalidate all tokens for this user
        const userBlacklistKey = `user_blacklist:${userId}`;
        // Set to expire in 24 hours (or use refresh token expiry)
        await redis.setWithTTL(userBlacklistKey, true, 86400);

        return res.status(200).json({
            status: true,
            error: null,
            message: 'Logged out from all devices'
        });

    } catch (error) {
        next(error);
    }
});

module.exports = Router;
