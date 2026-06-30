/**
 * Lock/Unlock Routes
 * Handles locking and unlocking user accounts
 */

const Router = require('express').Router();
const lockUnlockController = require('../../../controllers/auth/lock_unlock/lock_unlock');

/**
 * @swagger
 * /auth/lock-unlock:
 *   post:
 *     summary: "Lock or unlock a user account"
 *     description: "Lock or unlock a user account. Requires admin/system_admin role."
 *     tags: [Authentication - Account Lock]
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
 *               - action
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User's MongoDB ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               action:
 *                 type: string
 *                 enum: [lock, unlock]
 *                 description: Action to perform - lock or unlock
 *                 example: "lock"
 *               reason:
 *                 type: string
 *                 description: Reason for locking the account (required when action is 'lock')
 *                 example: "Too many failed login attempts"
 *     responses:
 *       200:
 *         description: Account locked/unlocked successfully
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
 *                   example: "Account locked successfully"
 *       400:
 *         description: Invalid action or missing fields
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
Router.post('/', lockUnlockController.lockUnlockAccount);

/**
 * @swagger
 * /auth/lock-unlock/status:
 *   post:
 *     summary: "Check account lock status"
 *     description: "Check if a user account is locked and view lock details."
 *     tags: [Authentication - Account Lock]
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
 *         description: Lock status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 isLocked:
 *                   type: boolean
 *                   example: true
 *                 failedAttempts:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
Router.post('/status', lockUnlockController.checkLockStatus);

/**
 * @swagger
 * /auth/lock-unlock/reset-attempts:
 *   post:
 *     summary: "Reset login attempts for a user"
 *     description: "Reset the failed login attempt counter for a user account."
 *     tags: [Authentication - Account Lock]
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
 *         description: Login attempts reset successfully
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
 *                   example: "Login attempts reset successfully"
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
Router.post('/reset-attempts', lockUnlockController.resetLoginAttempts);

module.exports = Router;