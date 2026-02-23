/**
 * First-Time Login Routes
 * Handles account activation for users created by admin without password
 */

const Router = require("express").Router();
const firstLoginController = require("../../../controllers/auth/first-login/first-login");

/**
 * POST /auth/first-login/check
 * Step 1: Check if email exists and account is not activated
 */
Router.post("/check", firstLoginController.checkEmail);

/**
 * POST /auth/first-login/send-otp
 * Step 2: Send OTP to user's email for verification
 */
Router.post("/send-otp", firstLoginController.sendOTP);

/**
 * POST /auth/first-login/activate
 * Step 3: Verify OTP and create password
 */
Router.post("/activate", firstLoginController.activateAccount);

/**
 * POST /auth/first-login/resend
 * Resend OTP if previous one expired
 */
Router.post("/resend", firstLoginController.resendOTP);

module.exports = Router;
