/**
 * Profile routes - User profile management
 */

const Router = require('express').Router();
const changePasswordController = require('../../controllers/profile/change_password');
const authenticate = require('../../middlewares/authenticate');

/**
 * POST /profile/change-password
 * Change user password with validation
 */
Router.post('/change-password', authenticate, changePasswordController);

module.exports = Router;