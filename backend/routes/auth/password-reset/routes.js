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
 * @swagger
 * /auth/password-reset:
 *   post:
 *     summary: "Step 1: Request password reset - send OTP"
 *     description: "Initiate a password reset by providing the registered email. An OTP will be sent to the email for verification."
 *     tags: [Authentication - Password Reset]
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
 *         description: OTP sent to email successfully
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
 *         description: Email is required or user not found
 *       403:
 *         description: Account is locked
 *       500:
 *         description: Internal server error
 */
Router.post("/", requestResetController);

/**
 * @swagger
 * /auth/password-reset/verify:
 *   post:
 *     summary: "Step 2: Verify OTP for password reset"
 *     description: "Verify the OTP sent to the user's email. On success, returns a temporary token that can be used to reset the password."
 *     tags: [Authentication - Password Reset]
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
 *                 description: User ID received from step 1
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
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OTP verified successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tempToken:
 *                       type: string
 *                       example: "temp_token_signature_abc123"
 *       400:
 *         description: Invalid or expired OTP
 *       500:
 *         description: Internal server error
 */
Router.post("/verify", verifyOTPController);

/**
 * @swagger
 * /auth/password-reset/reset:
 *   post:
 *     summary: "Step 3: Reset password with temp token"
 *     description: "Set a new password using the temporary token received from OTP verification."
 *     tags: [Authentication - Password Reset]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - tempToken
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               tempToken:
 *                 type: string
 *                 description: Temporary token from OTP verification
 *                 example: "temp_token_signature_abc123"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: New password (min 6 characters)
 *                 example: "NewSecurePass123!"
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Confirm new password (must match newPassword)
 *                 example: "NewSecurePass123!"
 *     responses:
 *       200:
 *         description: Password reset successfully
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
 *                   example: "Password reset successfully"
 *       400:
 *         description: Invalid or expired token, passwords do not match, or validation error
 *       500:
 *         description: Internal server error
 */
Router.post("/reset", resetPasswordController);

/**
 * @swagger
 * /auth/password-reset/resend:
 *   post:
 *     summary: "Resend password reset OTP"
 *     description: "Resend a new OTP to the user's email if the previous one expired."
 *     tags: [Authentication - Password Reset]
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
Router.post("/resend", resendOTPController);

module.exports = Router;