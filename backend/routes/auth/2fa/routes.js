/**
 * 2FA Routes
 * Handles 2FA setup, verification, and admin toggle
 */

const Router = require('express').Router();
const toggle2FAController = require('../../../controllers/auth/2fa/toggle_2fa');
const setup2FAController = require('../../../controllers/auth/2fa/setup_2fa');
const verify2FASetupController = require('../../../controllers/auth/2fa/verify_2fa_setup');
const reset2FAController = require('../../../controllers/auth/2fa/reset_2fa');

// Import middleware
const authenticate = require('../../../middlewares/authenticate');

/**
 * @swagger
 * /auth/2fa/toggle:
 *   post:
 *     summary: "Enable or disable 2FA for a user (Admin only)"
 *     description: "Toggle 2FA status for a specific user account."
 *     tags: [Authentication - 2FA]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User's MongoDB ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               disable:
 *                 type: boolean
 *                 description: Set to true to disable 2FA, false to enable
 *                 example: true
 *     responses:
 *       200:
 *         description: 2FA toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "2FA disabled successfully for user"
 *       400:
 *         description: User ID is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
Router.post('/toggle', authenticate, toggle2FAController);

/**
 * @swagger
 * /auth/2fa/setup:
 *   post:
 *     summary: "Setup 2FA - Generate TOTP secret and QR code"
 *     description: "Generate a new TOTP secret and QR code for 2FA setup."
 *     tags: [Authentication - 2FA]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User's MongoDB ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: 2FA setup generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "TOTP secret generated"
 *                 data:
 *                   type: object
 *                   properties:
 *                     secret:
 *                       type: string
 *                       example: "JBSWY3DPEHPK3PXP"
 *                     qrCode:
 *                       type: string
 *                       example: "data:image/png;base64,iVBORw0KGgo..."
 *       400:
 *         description: User ID is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
Router.post('/setup', authenticate, setup2FAController);

/**
 * @swagger
 * /auth/2fa/verify-setup:
 *   post:
 *     summary: "Verify 2FA setup with TOTP token"
 *     description: "Verify the TOTP token entered by the user to complete 2FA setup."
 *     tags: [Authentication - 2FA]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - otp
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User's MongoDB ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               otp:
 *                 type: string
 *                 description: 6-digit TOTP token
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA setup verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "TOTP verified successfully"
 *       400:
 *         description: Invalid parameters or TOTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
Router.post('/verify-setup', authenticate, verify2FASetupController);

/**
 * @swagger
 * /auth/2fa/reset:
 *   post:
 *     summary: "Reset 2FA for a user (Admin only)"
 *     description: "Remove 2FA secret and force user to set up 2FA again on next login."
 *     tags: [Authentication - 2FA]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User's MongoDB ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: 2FA reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "2FA has been reset for user"
 *       400:
 *         description: User ID is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
Router.post('/reset', authenticate, reset2FAController);

module.exports = Router;
