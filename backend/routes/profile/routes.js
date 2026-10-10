const Router = require('express').Router();
const changePasswordController = require('../../controllers/profile/change_password');
const authenticate = require('../../middlewares/authenticate');

/**
 * @swagger
 * /profile/change-password:
 *   post:
 *     summary: "Change user password"
 *     description: "Change the authenticated user's password. Requires current password verification."
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: "Current account password"
 *                 example: "OldPass123!"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: "New password (min 6 characters)"
 *                 example: "NewSecurePass456!"
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: "Confirm new password"
 *                 example: "NewSecurePass456!"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Password changed successfully"
 *       400:
 *         description: "Missing required fields, passwords do not match, or invalid current password"
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
Router.post('/change-password', changePasswordController);

// Account-level notification switch, honored by every notification sender.
const { getNotificationSettings, updateNotificationSettings } = require('../../controllers/profile/notification_settings');
Router.get('/notification-settings', getNotificationSettings);
Router.put('/notification-settings', updateNotificationSettings);

// Signature image a staff member's event attendance is signed with.
const express = require('express');
const signingProfile = require('../../controllers/profile/signing_profile');
// 400 KB body room for base64 PNGs; main.js's app-wide express.json() (100 KB default) still runs first and must be raised too
Router.use(express.json({ limit: '400kb' }));
Router.get('/signing-profile', signingProfile.getSigningProfile);
Router.put('/signature-image', signingProfile.updateSignatureImage);
Router.delete('/signature-image', signingProfile.removeSignatureImage);

// Digital certificate (.p12/.pfx) kept on the profile once its password has been verified; em_backend signs with it
// when the holder types that password on the attendance form, so the container is never served back out
Router.put('/signing-certificate', signingProfile.updateSigningCertificate);
Router.delete('/signing-certificate', signingProfile.removeSigningCertificate);

module.exports = Router;