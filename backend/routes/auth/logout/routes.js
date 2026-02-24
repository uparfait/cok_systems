/**
 * Logout Routes
 * Handles user logout and token invalidation
 */

const Router = require('express').Router();
const singleLogoutController = require('../../../controllers/auth/logout/single_logout');
const allLogoutController = require('../../../controllers/auth/logout/all_logout');

/**
 * POST /auth/logout
 * Invalidate user's current JWT token
 */
Router.post('/', singleLogoutController);

/**
 * POST /auth/logout/all
 * Logout from all devices (invalidate all tokens for user)
 */
Router.post('/all', allLogoutController);

module.exports = Router;
