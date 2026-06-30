/**
 * First Login Routes
 * Handles account activation for users created by admin without password
 */

const Router = require('express').Router();
const checkEmailController = require('../../../controllers/auth/first-login/check_email');
const sendOTPController = require('../../../controllers/auth/first-login/send_otp');
const activateAccountController = require('../../../controllers/auth/first-login/activate_account');
const resendOTPController = require('../../../controllers/auth/first-login/resend_otp');
const verifyOTPController = require('../../../controllers/auth/first-login/verify_otp');

/**
 * @swagger
 * /auth/first-login/check:
 *   post:
 *     summary: "Step 1: Check if account needs activation"
 *     description: "Check if the email exists in the system and the account hasn't been activated yet."
 *     tags: [Authentication - First Login]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Registered email address
 *                 example: "john.doe@cok.gov.rw"
 *     responses:
 *       200:
 *         description: Account found, can proceed with activation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Account found, you can proceed with activation"
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: "john.doe@cok.gov.rw"
 *       400:
 *         description: Account already activated
 *       403:
 *         description: Account is locked
 *       404:
 *         description: Account not found
 *       500:
 *         description: Internal server error
 */
Router.post('/check', checkEmailController);

/**
 * @swagger
 * /auth/first-login/send-otp:
 *   post:
 *     summary: "Step 2: Send OTP for account activation"
 *     description: "Send an OTP to the user's email for account activation verification."
 *     tags: [Authentication - First Login]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Registered email address
 *                 example: "john.doe@cok.gov.rw"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OTP sent to your email"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *       400:
 *         description: Account already activated
 *       403:
 *         description: Account is locked
 *       500:
 *         description: Internal server error
 */
Router.post('/send-otp', sendOTPController);

/**
 * @swagger
 * /auth/first-login/activate:
 *   post:
 *     summary: "Step 4: Activate account with password"
 *     description: "Activate the account by setting a new password. Requires the signature token from OTP verification."
 *     tags: [Authentication - First Login]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - signature
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               signature:
 *                 type: string
 *                 description: Signature token received from OTP verification
 *                 example: "signature_token_abc123"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: New password for the account
 *                 example: "SecurePass123!"
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Confirm new password
 *                 example: "SecurePass123!"
 *     responses:
 *       200:
 *         description: Account activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Account activated successfully"
 *       400:
 *         description: Invalid or expired signature, or validation error
 *       403:
 *         description: Account is locked
 *       500:
 *         description: Internal server error
 */
Router.post('/activate', activateAccountController);

/**
 * @swagger
 * /auth/first-login/verify-otp:
 *   post:
 *     summary: "Step 3: Verify OTP for account activation"
 *     description: "Verify the OTP sent to the user's email. On success, returns a signature token used for setting the password."
 *     tags: [Authentication - First Login]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - otp
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               otp:
 *                 type: string
 *                 description: OTP code received via email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OTP verified successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     signature:
 *                       type: string
 *                       example: "signature_token_abc123"
 *       400:
 *         description: Invalid OTP or no OTP found
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
Router.post('/verify-otp', verifyOTPController);

/**
 * @swagger
 * /auth/first-login/resend:
 *   post:
 *     summary: "Resend activation OTP"
 *     description: "Resend a new activation OTP to the user's email if the previous one expired."
 *     tags: [Authentication - First Login]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - email
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Registered email address
 *                 example: "john.doe@cok.gov.rw"
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OTP resent successfully"
 *       403:
 *         description: Account is locked
 *       500:
 *         description: Internal server error
 */
Router.post('/resend', resendOTPController);


module.exports = Router;