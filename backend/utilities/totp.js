/**
 * TOTP (Time-based One-Time Password) Utility
 * Handles 2FA secret generation, QR code creation, and token verification using speakeasy
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const TWOFA_ISSUER = 'IKAZE';
const TWOFA_ALGORITHM = 'sha512';
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
        algorithm: TWOFA_ALGORITHM,
        period: TWOFA_PERIOD,
        digits: TWOFA_DIGITS
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
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
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
    try {
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            algorithm: TWOFA_ALGORITHM,
            period: TWOFA_PERIOD,
            digits: TWOFA_DIGITS,
            window: 2
        });

        return {
            valid: verified
        };
    } catch (error) {
        return {
            valid: false,
            error: 'Invalid TOTP token'
        };
    }
};

/**
 * Generate a current TOTP token (for testing/debugging)
 * @param {string} secret - The base32 secret
 * @returns {string} - Current 6-digit TOTP token
 */
const generateCurrentTOTP = (secret) => {
    return speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        algorithm: TWOFA_ALGORITHM,
        period: TWOFA_PERIOD,
        digits: TWOFA_DIGITS
    });
};

module.exports = {
    generateTOTPSecret,
    generateQRCode,
    verifyTOTPToken,
    generateCurrentTOTP,
    TWOFA_ISSUER,
    TWOFA_ALGORITHM,
    TWOFA_PERIOD,
    TWOFA_DIGITS
};
