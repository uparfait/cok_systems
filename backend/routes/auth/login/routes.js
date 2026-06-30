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
 * @swagger
 * /auth/login:
 *   post:
 *     summary: "Step 1: Verify credentials and send OTP"
 *     description: "Authenticate user with email and password. If credentials are valid, an OTP is sent to the user's email for 2FA verification. In development mode, OTP verification is disabled and any numbers will work."
 *     tags: [Authentication - Login]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "john.doe@cok.gov.rw"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's account password
 *                 example: "SecurePass123!"
 *     responses:
 *       200:
 *         description: OTP sent successfully (or OTP disabled in dev mode)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 error:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 message:
 *                   type: string
 *                   example: "OTP sent to your email. Please verify to complete login."
 *                 data:
 *                   type: object
 *                   properties:
 *                     requiresOTP:
 *                       type: boolean
 *                       example: true
 *                     userId:
 *                       type: string
 *                       example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *       400:
 *         description: Missing required fields (email and password)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Email and password are required"
 *                 message:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid email or password"
 *                 data:
 *                   type: object
 *                   properties:
 *                     remainingAttempts:
 *                       type: integer
 *                       example: 4
 *       403:
 *         description: Account locked or not activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Account locked"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isLocked:
 *                       type: boolean
 *                       example: true
 *                     reason:
 *                       type: string
 *                       example: "Account locked due to too many failed login attempts"
 *                     requiresActivation:
 *                       type: boolean
 *                       example: true
 *       500:
 *         description: Internal server error
 */
Router.post('/', loginController);

/**
 * @swagger
 * /auth/login/verify:
 *   post:
 *     summary: "Step 2: Verify OTP and get JWT token"
 *     description: "Verify the OTP sent to the user's email. On success, returns JWT access and refresh tokens. In development mode, OTP verification is disabled - any userId works."
 *     tags: [Authentication - Login]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID received from login step 1
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               otp:
 *                 type: string
 *                 description: OTP code sent to email (optional in dev mode)
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login successful, returns JWT tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 type:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     verified:
 *                       type: boolean
 *                       example: true
 *                     userId:
 *                       type: string
 *                       example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                     email:
 *                       type: string
 *                       example: "john.doe@cok.gov.rw"
 *                     fullName:
 *                       type: string
 *                       example: "John Doe"
 *                     role:
 *                       type: string
 *                       example: "system_admin"
 *                     telephone:
 *                       type: string
 *                       example: "+250788123456"
 *                     accessToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     refreshToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Missing userId or invalid/expired OTP
 *       401:
 *         description: User not found
 *       403:
 *         description: Account not activated or locked
 *       500:
 *         description: Internal server error
 */
Router.post('/verify',
  auditSuccess('LOGIN', 'auth', auditUserActions.login),
  verifyLoginController
);

/**
 * @swagger
 * /auth/login/resend:
 *   post:
 *     summary: "Resend OTP for login"
 *     description: "Resend a new OTP to the user's email if the previous one expired or was not received."
 *     tags: [Authentication - Login]
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
 *                 description: User's MongoDB ID
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
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
 *       400:
 *         description: User ID and email required
 *       403:
 *         description: Account is locked
 *       500:
 *         description: Internal server error
 */
Router.post('/resend', resendOTPController);

// Add error logging for auth operations
Router.use(auditError('auth'));

module.exports = Router;