/**
 * Lock/Unlock Routes
 * Handles locking and unlocking user accounts
 */

const Router = require('express').Router();
const lockUnlockController = require('../../../controllers/auth/lock_unlock/lock_unlock');

/**
 * POST /auth/lock-unlock
 * Lock or unlock a user account
 * Body: { userId, action: 'lock' | 'unlock', reason?: string }
 */
Router.post('/', lockUnlockController.lockUnlockAccount);

/**
 * POST /auth/lock-unlock/status
 * Check account lock status
 * Body: { userId }
 */
Router.post('/status', lockUnlockController.checkLockStatus);

/**
 * POST /auth/lock-unlock/reset-attempts
 * Reset login attempts for a user
 * Body: { userId }
 */
Router.post('/reset-attempts', lockUnlockController.resetLoginAttempts);

module.exports = Router;
