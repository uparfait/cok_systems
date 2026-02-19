/**
 * JWT (JSON Web Token) Utility
 * Handles token generation and verification for authentication
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');

const JWT_EXPIRY = '24h';           // Access token expiry
const REFRESH_TOKEN_EXPIRY = '7d';  // Refresh token expiry

/**
 * Generate access token
 * @param {object} payload - Data to encode in token
 * @returns {string} - JWT access token
 */
const generateAccessToken = (payload) => {
    return jwt.sign(payload, config.jwtSecret || 'cok-jwt-secret-2026', {
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
            decoded: jwt.verify(token, config.jwtSecret || 'cok-jwt-secret-2026')
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

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    decodeToken,
    extractToken,
    JWT_EXPIRY,
    REFRESH_TOKEN_EXPIRY
};
