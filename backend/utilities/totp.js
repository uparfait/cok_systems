/**
 * TOTP (Time-based One-Time Password) Utility
 * Handles 2FA secret generation, QR code creation, and token verification using speakeasy
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const TWOFA_ISSUER = 'IKAZE';
const TWOFA_ALGORITHM = 'sha1'
const TWOFA_PERIOD = 30;
const TWOFA_DIGITS = 6;

/**
 * Generate a new TOTP secret for a user
 * @param {string} email - User's email address
 * @returns {object} - { secret: string, otpauthUrl: string }
 */
const generateTOTPSecret = (email) => {
    const secret = speakeasy.generateSecret({
        name: `${TWOFA_ISSUER}:${email}`,
        issuer: TWOFA_ISSUER,
        length: 20 // secret length (default is 32)
    });

    return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url
    };
};

/**
 * Generate QR code data URL from otpauth URL
 * @param {string} otpauthUrl - The otpauth URL
 * @returns {Promise<string>} - QR code as data URL
 */
const generateQRCode = async (otpauthUrl) => {
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            margin: 2,
            width: 300
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
 * @returns {object} - { valid: boolean, error?: string }
 */
const verifyTOTPToken = (token, secret) => {
    // Validate inputs
    if (!token || !secret) {
        return {
            valid: false,
            error: 'Token and secret are required'
        };
    }

    // Validate token format
    if (!/^\d{6}$/.test(token)) {
        return {
            valid: false,
            error: 'Token must be a 6-digit number'
        };
    }

    try {
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            algorithm: TWOFA_ALGORITHM,
            period: TWOFA_PERIOD,
            digits: TWOFA_DIGITS,
            window: 2 // Allows 2 steps before/after for time drift
        });

        return {
            valid: verified,
            ...(verified ? {} : { error: 'Invalid TOTP token' })
        };
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
 */
const generateCurrentTOTP = (secret) => {
    if (!secret) {
        throw new Error('Secret is required to generate TOTP');
    }
    
    return speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        algorithm: TWOFA_ALGORITHM,
        period: TWOFA_PERIOD,
        digits: TWOFA_DIGITS
    });
};

/**
 * Get remaining seconds for current TOTP window
 * @param {number} period - The period in seconds (default: 30)
 * @returns {number} - Seconds remaining in current window
 */
const getRemainingSeconds = (period = TWOFA_PERIOD) => {
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
};

/**
 * Generate backup codes for account recovery
 * @param {number} count - Number of backup codes to generate
 * @param {number} length - Length of each backup code
 * @returns {string[]} - Array of backup codes
 */
const generateBackupCodes = (count = 10, length = 8) => {
    const crypto = require('crypto');
    const codes = [];
    
    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(Math.ceil(length / 2))
            .toString('hex')
            .substring(0, length)
            .toUpperCase();
        codes.push(code);
    }
    
    return codes;
};

/**
 * Format secret for display (groups of 4 characters)
 * @param {string} secret - The base32 secret
 * @returns {string} - Formatted secret
 */
const formatSecret = (secret) => {
    if (!secret) return '';
    return secret.match(/.{1,4}/g).join(' ');
};

module.exports = {
    generateTOTPSecret,
    generateQRCode,
    verifyTOTPToken,
    generateCurrentTOTP,
    getRemainingSeconds,
    generateBackupCodes,
    formatSecret,
    TWOFA_ISSUER,
    TWOFA_ALGORITHM,
    TWOFA_PERIOD,
    TWOFA_DIGITS
};