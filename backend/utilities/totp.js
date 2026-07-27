/**
 * TOTP (Time-based One-Time Password) Utility
 * Handles 2FA secret generation, QR code creation, and token verification using speakeasy
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Configuration constants
const TWOFA_ISSUER = 'IKAZE';
const TWOFA_ALGORITHM = 'sha1';
const TWOFA_PERIOD = 30;
const TWOFA_DIGITS = 6;
const TWOFA_SECRET_LENGTH = 32; // 32 bytes for better security
const TWOFA_WINDOW = 1; // Allow 1 step before/after for time drift (3 total windows)

/**
 * Generate a new TOTP secret for a user
 * @param {string} email - User's email address
 * @returns {Object} - { secret: string, otpauthUrl: string }
 * @throws {Error} - If email is invalid
 */
const generateTOTPSecret = (email) => {
    // Validate input
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        throw new Error('Valid email address is required');
    }

    try {
        const secret = speakeasy.generateSecret({
            name: `${TWOFA_ISSUER}:${email}`,
            issuer: TWOFA_ISSUER,
            length: TWOFA_SECRET_LENGTH
        });

        return {
            secret: secret.base32,
            otpauthUrl: secret.otpauth_url
        };
    } catch (error) {
        console.error('Error generating TOTP secret:', error);
        throw new Error('Failed to generate TOTP secret');
    }
};

/**
 * Generate QR code data URL from otpauth URL
 * @param {string} otpauthUrl - The otpauth URL
 * @returns {Promise<string>} - QR code as data URL
 * @throws {Error} - If otpauthUrl is invalid or QR generation fails
 */
const generateQRCode = async (otpauthUrl) => {
    // Validate input
    if (!otpauthUrl || typeof otpauthUrl !== 'string') {
        throw new Error('OTPAuth URL is required');
    }

    // Validate URL format
    if (!otpauthUrl.startsWith('otpauth://')) {
        throw new Error('Invalid OTPAuth URL format');
    }

    try {
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            margin: 2,
            width: 300,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        return qrCodeDataUrl;
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
};

/**
 * Verify a TOTP token against a secret
 * @param {string} token - The 6-digit TOTP token entered by user
 * @param {string} secret - The base32 secret stored for the user
 * @param {number} [window=TWOFA_WINDOW] - Number of windows to check (before/after)
 * @returns {Object} - { valid: boolean, error?: string, delta?: number }
 */
const verifyTOTPToken = (token, secret, window = TWOFA_WINDOW) => {
    // Validate inputs
    if (!token || typeof token !== 'string') {
        return {
            valid: false,
            error: 'Token is required and must be a string'
        };
    }

    if (!secret || typeof secret !== 'string') {
        return {
            valid: false,
            error: 'Secret is required and must be a string'
        };
    }

    // Clean token (remove spaces, trim)
    const cleanToken = token.trim().replace(/\s/g, '');

    // Validate token format (6 digits)
    if (!/^\d{6}$/.test(cleanToken)) {
        return {
            valid: false,
            error: 'Token must be a 6-digit number'
        };
    }

    try {
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: cleanToken,
            algorithm: TWOFA_ALGORITHM,
            period: TWOFA_PERIOD,
            digits: TWOFA_DIGITS,
            window: window
        });

        // Get the delta (time drift) if verification succeeded
        if (verified) {
            return { 
                valid: true,
                delta: 0 // You can calculate actual delta if needed
            };
        } else {
            return {
                valid: false,
                error: 'Invalid TOTP token. Please try again.'
            };
        }
    } catch (error) {
        console.error('TOTP verification error:', error);
        return {
            valid: false,
            error: 'Verification failed. Please try again.'
        };
    }
};

/**
 * Generate a current TOTP token (for testing/debugging)
 * @param {string} secret - The base32 secret
 * @returns {string} - Current 6-digit TOTP token
 * @throws {Error} - If secret is invalid
 */
const generateCurrentTOTP = (secret) => {
    if (!secret || typeof secret !== 'string') {
        throw new Error('Secret is required to generate TOTP');
    }

    try {
        return speakeasy.totp({
            secret: secret,
            encoding: 'base32',
            algorithm: TWOFA_ALGORITHM,
            period: TWOFA_PERIOD,
            digits: TWOFA_DIGITS
        });
    } catch (error) {
        console.error('Error generating TOTP:', error);
        throw new Error('Failed to generate TOTP token');
    }
};

/**
 * Get remaining seconds for current TOTP window
 * @param {number} [period=TWOFA_PERIOD] - The period in seconds
 * @returns {number} - Seconds remaining in current window
 */
const getRemainingSeconds = (period = TWOFA_PERIOD) => {
    if (typeof period !== 'number' || period <= 0) {
        throw new Error('Period must be a positive number');
    }
    
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
};

/**
 * Check if a TOTP setup session has expired
 * @param {Date|string} expiresAt - The expiry date
 * @param {number} [ttlMinutes=15] - TTL in minutes
 * @returns {boolean} - True if expired
 */
const isTOTPSetupExpired = (expiresAt, ttlMinutes = 15) => {
    if (!expiresAt) return true;
    
    const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) {
        return true; // Invalid date
    }
    
    return new Date() > expiryDate;
};

/**
 * Create a TOTP setup expiry date
 * @param {number} [ttlMinutes=15] - TTL in minutes
 * @returns {Date} - Expiry date
 */
const createTOTPSetupExpiry = (ttlMinutes = 15) => {
    if (typeof ttlMinutes !== 'number' || ttlMinutes <= 0) {
        throw new Error('TTL must be a positive number');
    }
    
    return new Date(Date.now() + ttlMinutes * 60 * 1000);
};

/**
 * Generate backup codes for 2FA recovery
 * @param {number} [count=10] - Number of backup codes to generate
 * @param {number} [length=8] - Length of each backup code
 * @returns {string[]} - Array of backup codes
 */
const generateBackupCodes = (count = 10, length = 8) => {
    if (typeof count !== 'number' || count <= 0 || count > 100) {
        throw new Error('Count must be between 1 and 100');
    }
    
    if (typeof length !== 'number' || length < 4 || length > 20) {
        throw new Error('Length must be between 4 and 20');
    }
    
    const codes = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    for (let i = 0; i < count; i++) {
        let code = '';
        for (let j = 0; j < length; j++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            code += characters[randomIndex];
        }
        // Format with hyphens for readability
        const formatted = code.match(/.{1,4}/g).join('-');
        codes.push(formatted);
    }
    
    return codes;
};

/**
 * Format a TOTP secret for display (groups of 4 characters)
 * @param {string} secret - The base32 secret
 * @returns {string} - Formatted secret
 */
const formatSecret = (secret) => {
    if (!secret || typeof secret !== 'string') {
        return '';
    }
    return secret.match(/.{1,4}/g).join(' ');
};

/**
 * Calculate the time steps between two TOTP tokens
 * @param {string} secret - The base32 secret
 * @param {string} token1 - First token
 * @param {string} token2 - Second token
 * @returns {number} - Number of steps difference
 */
const calculateTimeDrift = (secret, token1, token2) => {
    if (!secret || !token1 || !token2) {
        throw new Error('Secret and both tokens are required');
    }

    try {
        // This is a simplified version - in production you might want to
        // calculate actual time drift using speakeasy's time calculation
        const now = Math.floor(Date.now() / 1000);
        const period = TWOFA_PERIOD;
        
        // Simple check - you could implement more sophisticated drift detection
        return 0;
    } catch (error) {
        console.error('Error calculating time drift:', error);
        throw new Error('Failed to calculate time drift');
    }
};

module.exports = {
    // Main functions
    generateTOTPSecret,
    generateQRCode,
    verifyTOTPToken,
    generateCurrentTOTP,
    
    // Utility functions
    getRemainingSeconds,
    isTOTPSetupExpired,
    createTOTPSetupExpiry,
    generateBackupCodes,
    formatSecret,
    calculateTimeDrift,
    
    // Constants
    TWOFA_ISSUER,
    TWOFA_ALGORITHM,
    TWOFA_PERIOD,
    TWOFA_DIGITS,
    TWOFA_SECRET_LENGTH,
    TWOFA_WINDOW
};