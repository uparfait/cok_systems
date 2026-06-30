/**
 * Logout Routes
 * Handles user logout and token invalidation
 */

const Router = require('express').Router();
const singleLogoutController = require('../../../controllers/auth/logout/single_logout');
const allLogoutController = require('../../../controllers/auth/logout/all_logout');

// Import audit logging
const { auditSuccess, auditError, auditUserActions } = require('../../../middlewares/audit');

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: "Logout from current device"
 *     description: "Invalidate the user's current JWT token. Requires authentication via Bearer token in the Authorization header."
 *     tags: [Authentication - Logout]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
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
 *                   example: "Logged out successfully"
 *       401:
 *         description: Not authenticated - missing or invalid token
 *       500:
 *         description: Internal server error
 */
Router.post('/', auditSuccess('LOGOUT', 'auth', auditUserActions.logout), singleLogoutController);

/**
 * @swagger
 * /auth/logout/all:
 *   post:
 *     summary: "Logout from all devices"
 *     description: "Invalidate all active tokens for the user. This logs the user out from all devices and sessions."
 *     tags: [Authentication - Logout]
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
 *         description: Logged out from all devices successfully
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
 *                   example: "Logged out from all devices"
 *       400:
 *         description: Missing userId
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
Router.post('/all', auditSuccess('LOGOUT', 'auth', (req, res, data) => `User logged out from all devices`), allLogoutController);

// Add error logging for logout operations
Router.use(auditError('auth'));

module.exports = Router;