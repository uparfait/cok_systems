/**
 * Logout Routes
 * Handles user logout and token invalidation
 */

const Router = require("express").Router();
const logoutController = require("../../../controllers/auth/logout/logout");

/**
 * POST /auth/logout
 * Invalidate user's JWT token
 */
Router.post("/", logoutController.logout);

/**
 * POST /auth/logout/all
 * Logout from all devices (invalidate all tokens for user)
 */
Router.post("/all", logoutController.logoutAll);

module.exports = Router;
