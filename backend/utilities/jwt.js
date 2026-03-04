/**
 * JWT (JSON Web Token) Utility
 * Handles token generation and verification for authentication
 */

const jwt = require('jsonwebtoken');
const config = require('../configurations/config.js');

const JWT_EXPIRY = '24h';           // Access token expiry
const REFRESH_TOKEN_EXPIRY = '7d';  // Refresh token expiry
const LOGIN_TOKEN_EXPIRY = '1d';   // Login token expiry (1 day)
const login_token_expiry_seconds = 5 * 60; // OTP expiry for login (5 minutes)
const JWT_SECRET = config.jwtSecret || 'cok-jwt-secret-2026';

/**
 * Generate access token
 * @param {object} payload - Data to encode in token
 * @returns {string} - JWT access token
 */
const generateAccessToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRY
    });
};

/**
 * Generate refresh token
 * @param {object} payload - Data to encode in token
 * @returns {string} - JWT refresh token
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, config.jwtRefreshSecret || 'cok-jwt-refresh-secret-2026', {
        expiresIn: REFRESH_TOKEN_EXPIRY
    });
};

/**
 * Generate both access and refresh tokens
 * @param {object} payload - Data to encode
 * @returns {object} - { accessToken, refreshToken }
 */
const generateTokens = (payload) => {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload)
    };
};

/**
 * Verify access token
 * @param {string} token - JWT token to verify
 * @returns {object} - Decoded token payload
 */
const verifyAccessToken = (token) => {
    try {
        return {
            valid: true,
            decoded: jwt.verify(token, JWT_SECRET)
        };
        
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
};

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {object} - Decoded token payload
 */
const verifyRefreshToken = (token) => {
    try {
        return {
            valid: true,
            decoded: jwt.verify(token, config.jwtRefreshSecret || 'cok-jwt-refresh-secret-2026')
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
};

/**
 * Decode token without verification (for inspection)
 * @param {string} token - JWT token to decode
 * @returns {object} - Decoded payload
 */
const decodeToken = (token) => {
    return jwt.decode(token);
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Token or null
 */
const extractToken = (authHeader) => {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    
    return parts[1];
};

/**
 * Sign a new JWT token
 * @param {object} payload - Data to encode in token
 * @param {string} secret - Secret key (optional, uses JWT_SECRET by default)
 * @param {object} options - Token options (expiresIn, etc.)
 * @returns {string} - JWT token
 */
const sign = (payload, secret = JWT_SECRET, options = {}) => {
    return jwt.sign(payload, secret, options);
};

/**
 * Hash login token
 * @param {string} token - Token to hash
 * @returns {string} - Hashed token
 */
const HashLoginToken = async (token) => {
    try {
        return jwt.sign({ token }, JWT_SECRET, {
            expiresIn: login_token_expiry_seconds
        });
    } catch (error) { 
        console.error('Error hashing token:', error);
        throw error;
    }
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    decodeToken,
    extractToken,
    sign,
    HashLoginToken,
    JWT_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    LOGIN_TOKEN_EXPIRY,
    JWT_SECRET
};
