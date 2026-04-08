const User = require('../../models/user.js');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const jwt = require('../../utilities/jwt');

/**
 * Password validation function
 * @param {string} password - Password to validate
 * @returns {object} - {valid: boolean, errors: string[]}
 */
const validatePassword = (password) => {
    const errors = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};


module.exports = async function changePassword(req, res, next) {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Extract userId from JWT token directly
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                type: 'warning',
                message: 'Authorization token required'
            });
        }

        const token = authHeader.substring(7);
        let tokenPayload;
        try {
            tokenPayload = jwt.verifyAccessToken(token);
        } catch (error) {
            return res.status(401).json({
                success: false,
                type: 'warning',
                message: 'Invalid or expired token'
            });
        }

        const userId = tokenPayload.userId;

        console.log('[changePassword] Extracted userId:', userId);
        console.log('[changePassword] userId type:', typeof userId);

        // Validate required fields
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'Current password, new password, and confirm password are required'
            });
        }

        // Check if new password matches confirm password
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'New password and confirm password do not match'
            });
        }

        // Validate new password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'Password validation failed',
                errors: passwordValidation.errors
            });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: 'User not found'
            });
        }

        if (!user) {
            console.log('[changePassword] User not found in database');
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: 'User not found'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'Current password is incorrect'
            });
        }

        // Check if new password is different from current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'New password must be different from current password'
            });
        }

        // Hash new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        user.password = hashedPassword;
        await user.save();

        // Send confirmation email
        try {
            const email = require('../../utilities/email.js');
            await email.sendPasswordChangedEmail(user.email, user.full_name);
        } catch (emailError) {
            console.error('Failed to send password change confirmation email:', emailError);
            // Don't fail the request if email fails
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Error in changePassword:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while changing password',
            error: error.message
        });
    }
};