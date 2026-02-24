/**
 * Password Reset Routes
 * Handles password reset with OTP verification
 */

const Router = require("express").Router();
const requestResetController = require("../../../controllers/auth/password-reset/request_reset");
const verifyOTPController = require("../../../controllers/auth/password-reset/verify_otp");
const resetPasswordController = require("../../../controllers/auth/password-reset/reset_password");
const resendOTPController = require("../../../controllers/auth/password-reset/resend_otp");

/**
 * POST /auth/password-reset
 * Step 1: Request password reset - send OTP to email
 */
Router.post("/", requestResetController);

/**
 * POST /auth/password-reset/verify
 * Step 2: Verify OTP and allow password change
 */
Router.post("/verify", verifyOTPController);

/**
 * POST /auth/password-reset/reset
 * Step 3: Set new password with temp token
 */
Router.post("/reset", resetPasswordController);

/**
 * POST /auth/password-reset/resend
 * Resend OTP if previous one expired
 */
Router.post("/resend", resendOTPController);

module.exports = Router;
