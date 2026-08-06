/**
 * OTP (One-Time Password) Generator Utility
 * Generates and validates OTPs for 2FA and password reset
 */

const OTP_LENGTH = 5;
const OTP_EXPIRY_SECONDS = 300; // 5 minutes

/**
 * Generate a random OTP code
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} - Generated OTP code
 */
const generateOTP = (length = OTP_LENGTH) => {
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10).toString();
    }
    return otp;
};

/**
 * Generate OTP with expiry timestamp
 * @returns {object} - { otp: string, expiresAt: Date }
 */
const generateOTPWithExpiry = () => {
    return {
        otp: generateOTP(),
        expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000
    };
};

/**
 * Validate OTP against stored value and expiry
 * @param {string} inputOTP - OTP entered by user
 * @param {string} storedOTP - OTP stored in database/Redis
 * @param {Date} expiresAt - Expiry timestamp
 * @returns {object} - { valid: boolean, error?: string }
 */
const validateOTP = (inputOTP, storedOTP, expiresAt) => {
    // Check if OTP matches
    if (inputOTP !== storedOTP) {
        return {
            valid: false,
            error: 'Invalid OTP'
        };
    }

    // Check if OTP has expired
    if (Date.now() > expiresAt) {
        return {
            valid: false,
            error: 'OTP has expired'
        };
    }

    return {
        valid: true
    };
};

/**
 * Generate a unique key for Redis storage
 * @param {string} type - 'login' or 'reset'
 * @param {string|number} userId - User ID
 * @returns {string} - Redis key
 */
const getOTPKey = (type, userId) => {
    return `otp:${type}:${userId}`;
};

/**
 * Mask OTP for display (show only last 2 digits)
 * @param {string} otp - Full OTP
 * @returns {string} - Masked OTP
 */
const maskOTP = (otp) => {
    if (!otp || otp.length < 2) return '******';
    return '*'.repeat(otp.length - 2) + otp.slice(-2);
};

module.exports = {
    generateOTP,
    generateOTPWithExpiry,
    validateOTP,
    getOTPKey,
    maskOTP,
    OTP_LENGTH,
    OTP_EXPIRY_SECONDS
};
