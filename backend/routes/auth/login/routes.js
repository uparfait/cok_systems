/**
 * Login Routes
 * Handles user login with OTP 2FA
 */

const Router = require('express').Router();
const loginController = require('../../../controllers/auth/login/login');
const verifyLoginController = require('../../../controllers/auth/login/verify_login');
const resendOTPController = require('../../../controllers/auth/login/resend_otp');

// Import audit logging
const { auditSuccess, auditError, auditUserActions } = require('../../../middlewares/audit');

/**
 * POST /auth/login
 * Step 1: Verify credentials, send OTP for 2FA
 */
Router.post('/', loginController);

/**
 * POST /auth/login/verify
 * Step 2: Verify OTP, issue JWT token
 */
Router.post('/verify',
  auditSuccess('LOGIN', 'auth', auditUserActions.login),
  verifyLoginController
);

/**
 * POST /auth/login/resend
 * Resend OTP if previous one expired
 */
Router.post('/resend', resendOTPController);

// Add error logging for auth operations
Router.use(auditError('auth'));

module.exports = Router;
