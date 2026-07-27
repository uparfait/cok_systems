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
const hashTokenLoginToken = async (token) => {
    try {
        // create a hashed token using jwt
        const hashed = jwt.HashLoginToken(token);
        return hashed;
    } catch (error) {
        console.error('Error hashing token:', error);
        throw error;
    }
};

/**
 * Compare raw token with hashed token from database
 * @param {string} rawToken - Raw OTP or JWT token from user
 * @param {string} hashedToken - Hashed/JWT token from database
 * @returns {Promise<boolean>} - True if match
 */
const compareToken = async (rawToken, hashedToken) => {
    try {
        // Check if the hashedToken is a JWT (contains dots)
        const isJWT = hashedToken && typeof hashedToken === 'string' && hashedToken.split('.').length === 3;
        
        if (isJWT) {
            // Verify the JWT token
            const verification = jwt.verifyAccessToken(hashedToken);
            
            if (!verification.valid) {
                return false;
            }
            
            // Check if the token payload's otp matches the raw token
            // Also check if it's a direct token match (for backward compatibility)
            return verification.decoded?.otp === rawToken || verification.decoded?.token === rawToken;
        } else {
            // Plain text comparison
            return hashedToken === rawToken;
        }
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

/**
 * Generate a JWT token with custom expiry and type
 * @param {object} payload - Data to encode in token
 * @param {string} expiry - Expiry time (e.g., '30m', '1h')
 * @param {string} type - Token type identifier
 * @returns {string} - Generated JWT token
 */
const generateToken = (payload, expiry = '30m', type = 'general') => {
    return jwt.sign({ ...payload, tokenType: type }, jwt.JWT_SECRET, {
        expiresIn: expiry
    });
};

/**
 * Verify a generated token and check its type
 * Supports both `tokenType` and `purpose` fields for backward compatibility
 * @param {string} token - JWT token to verify
 * @param {string} expectedType - Expected token type
 * @returns {object} - { valid: boolean, decoded?: object, error?: string }
 */
const verifyToken = (token, expectedType) => {
    try {
        const verification = jwt.verifyAccessToken(token);
        
        if (!verification.valid) {
            return { valid: false, error: verification.error };
        }
        
        // Check token type if expectedType is provided
        // Support both `tokenType` and `purpose` fields
        if (expectedType) {
            const tokenType = verification.decoded?.tokenType || verification.decoded?.purpose;
            if (tokenType !== expectedType) {
                return { valid: false, error: 'Invalid token type' };
            }
        }
        
        return { valid: true, decoded: verification.decoded };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

module.exports = {
    hashTokenLoginToken,
    compareToken,
    createUserToken,
    validateUserToken,
    invalidateUserToken,
    generateToken,
    verifyToken,

    SALT_ROUNDS
};
