/**
 * Password Reset Routes
 * Handles password reset with OTP verification
 */

const Router = require("express").Router();
const passwordResetController = require("../../../controllers/auth/password-reset/password-reset");

/**
 * POST /auth/password-reset
 * Step 1: Request password reset - send OTP to email
 */
Router.post("/", passwordResetController.requestReset);

/**
 * POST /auth/password-reset/verify
 * Step 2: Verify OTP and allow password change
 */
Router.post("/verify", passwordResetController.verifyOTP);

/**
 * POST /auth/password-reset/reset
 * Step 3: Set new password with temp token
 */
Router.post("/reset", passwordResetController.resetPassword);

/**
 * POST /auth/password-reset/resend
 * Resend OTP if previous one expired
 */
Router.post("/resend", passwordResetController.resendOTP);

module.exports = Router;
