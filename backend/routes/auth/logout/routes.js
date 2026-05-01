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
 * POST /auth/logout
 * Invalidate user's current JWT token
 */
Router.post('/', auditSuccess('LOGOUT', 'auth', auditUserActions.logout), singleLogoutController);

/**
 * POST /auth/logout/all
 * Logout from all devices (invalidate all tokens for user)
 */
Router.post('/all', auditSuccess('LOGOUT', 'auth', (req, res, data) => `User logged out from all devices`), allLogoutController);

// Add error logging for logout operations
Router.use(auditError('auth'));

module.exports = Router;
