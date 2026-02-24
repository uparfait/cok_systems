/**
 * First Login Routes
 * Handles account activation for users created by admin without password
 */

const Router = require('express').Router();
const checkEmailController = require('../../../controllers/auth/first-login/check_email');
const sendOTPController = require('../../../controllers/auth/first-login/send_otp');
const activateAccountController = require('../../../controllers/auth/first-login/activate_account');
const resendOTPController = require('../../../controllers/auth/first-login/resend_otp');

/**
 * POST /auth/first-login/check
 * Step 1: Check if email exists and account is not activated
 */
Router.post('/check', checkEmailController);

/**
 * POST /auth/first-login/send-otp
 * Step 2: Send OTP to user's email for verification
 */
Router.post('/send-otp', sendOTPController);

/**
 * POST /auth/first-login/activate
 * Step 3: Verify OTP and create password
 */
Router.post('/activate', activateAccountController);

/**
 * POST /auth/first-login/resend
 * Resend OTP if previous one expired
 */
Router.post('/resend', resendOTPController);

module.exports = Router;
