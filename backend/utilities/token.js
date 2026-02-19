/**
 * Token Utility
 * Handles token hashing for secure database storage
 */

const bcrypt = require('bcrypt');
const jwt = require('./jwt');

const SALT_ROUNDS = 10;

/**
 * Hash a token before storing in database
 * @param {string} token - Raw JWT token
 * @returns {Promise<string>} - Hashed token
 */
const hashToken = async (token) => {
    try {
        const hashed = await bcrypt.hash(token, SALT_ROUNDS);
        return hashed;
    } catch (error) {
        console.error('Error hashing token:', error);
        throw error;
    }
};

/**
 * Compare raw token with hashed token from database
 * @param {string} rawToken - Raw JWT token
 * @param {string} hashedToken - Hashed token from database
 * @returns {Promise<boolean>} - True if match
 */
const compareToken = async (rawToken, hashedToken) => {
    try {
        return await bcrypt.compare(rawToken, hashedToken);
    } catch (error) {
        console.error('Error comparing token:', error);
        return false;
    }
};

/**
 * Create and store a token for user
 * @param {object} user - User object with userId, email, role
 * @returns {Promise<object>} - { rawToken, hashedToken, tokens }
 */
const createUserToken = async (user) => {
    // Generate JWT tokens
    const tokens = jwt.generateTokens({
        userId: user.userId || user._id,
        email: user.email,
        role: user.role
    });

    // Hash the access token for database storage
    const hashedToken = await hashToken(tokens.accessToken);

    return {
        rawToken: tokens.accessToken,
        hashedToken,
        refreshToken: tokens.refreshToken,
        tokens
    };
};

/**
 * Validate token against database hash
 * @param {string} rawToken - Raw JWT token from request
 * @param {string} hashedToken - Hashed token from database
 * @returns {Promise<object>} - { valid: boolean, decoded?: object }
 */
const validateUserToken = async (rawToken, hashedToken) => {
    try {
        // First verify the token signature
        const verification = jwt.verifyAccessToken(rawToken);
        
        if (!verification.valid) {
            return { valid: false, error: verification.error };
        }

        // Then compare hash
        const hashMatch = await compareToken(rawToken, hashedToken);
        
        if (!hashMatch) {
            return { valid: false, error: 'Token mismatch' };
        }

        return { valid: true, decoded: verification.decoded };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

/**
 * Invalidate token in database (would be called from logout or token refresh)
 * This would typically update the user's record in DB
 * @param {string} userId - User ID
 * @param {object} db - Database connection
 * @returns {Promise<boolean>}
 */
const invalidateUserToken = async (userId, db) => {
    try {
        // This would update the user's auth.token in database to null or generate new one
        // Example: await db.collection('system_users').updateOne(
        //     { _id: userId },
        //     { $set: { 'auth.access_token': null, 'auth.token_expiry': null } }
        // );
        
        // For now, just return true - implement with actual DB
        return true;
    } catch (error) {
        console.error('Error invalidating token:', error);
        return false;
    }
};

module.exports = {
    hashToken,
    compareToken,
    createUserToken,
    validateUserToken,
    invalidateUserToken,
    SALT_ROUNDS
};
