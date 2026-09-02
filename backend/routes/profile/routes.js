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

module.exports = Router;