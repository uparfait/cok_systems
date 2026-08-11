/**
 * Routes for Web Push Notifications
 */

const Router = require('express').Router();
const { auditSuccess, auditError } = require('../../middlewares/audit');
const authenticate = require('../../middlewares/authenticate');

const { VAPID_PUBLIC_KEY } = require('../../configurations/webpush');
const { subscribe } = require('../../controllers/webpush/subscribe');
const { unsubscribe } = require('../../controllers/webpush/unsubscribe');
const { getSubscription } = require('../../controllers/webpush/get_subscription');
const { sendToAll, sendToRole, sendToUser, sendTest } = require('../../controllers/webpush/send_notifications');

const multer = require('multer');
const upload = multer();

Router.use(upload.any());

Router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/**
 * @swagger
 * /webpush/subscribe:
 *   post:
 *     summary: "Subscribe to push notifications"
 *     description: "Subscribe the authenticated user to push notifications. Stores subscription with user details."
 *     tags: [WebPush]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *               - keys
 *             properties:
 *               endpoint:
 *                 type: string
 *               keys:
 *                 type: object
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                   auth:
 *                     type: string
 *               userAgent:
 *                 type: string
 *     responses:
 *       201:
 *         description: Subscribed successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
Router.post('/subscribe', authenticate, auditSuccess('CREATE', 'push_subscriptions'), subscribe)

/**
 * @swagger
 * /webpush/unsubscribe:
 *   post:
 *     summary: "Unsubscribe from push notifications"
 *     description: "Unsubscribe the authenticated user from push notifications."
 *     tags: [WebPush]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *             properties:
 *               endpoint:
 *                 type: string
 *     responses:
 *       200:
 *         description: Unsubscribed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Server error
 */
Router.post('/unsubscribe', authenticate, auditSuccess('DELETE', 'push_subscriptions'), unsubscribe)

/**
 * @swagger
 * /webpush/subscription:
 *   get:
 *     summary: "Get current user's subscription status"
 *     description: "Check if the authenticated user has an active push subscription."
 *     tags: [WebPush]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status retrieved
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
Router.get('/subscription', authenticate, auditSuccess('READ', 'push_subscriptions'), getSubscription)

/**
 * @swagger
 * /webpush/send/all:
 *   post:
 *     summary: "Send push notification to all subscribers"
 *     description: "Send a push notification to all active subscribers. Admin only."
 *     tags: [WebPush]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               icon:
 *                 type: string
 *               badge:
 *                 type: string
 *               tag:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notification sent
 *       404:
 *         description: No subscribers found
 *       500:
 *         description: Server error
 */
Router.post('/send/all', authenticate, auditSuccess('CREATE', 'push_notifications'), sendToAll)

/**
 * @swagger
 * /webpush/send/role/{role}:
 *   post:
 *     summary: "Send push notification to users of a specific role"
 *     description: "Send a push notification to all active subscribers with a specific role."
 *     tags: [WebPush]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *         description: "Role name (e.g. system_admin, department_employee)"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               icon:
 *                 type: string
 *               badge:
 *                 type: string
 *               tag:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notification sent
 *       404:
 *         description: No subscribers found for this role
 *       500:
 *         description: Server error
 */
Router.post('/send/role/:role', authenticate, auditSuccess('CREATE', 'push_notifications'), sendToRole)

/**
 * @swagger
 * /webpush/send/user/{userId}:
 *   post:
 *     summary: "Send push notification to a single user"
 *     description: "Send a push notification to a specific user by their ID."
 *     tags: [WebPush]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: "User's MongoDB ObjectId"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               icon:
 *                 type: string
 *               badge:
 *                 type: string
 *               tag:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notification sent
 *       404:
 *         description: No subscription found for user
 *       500:
 *         description: Server error
 */
Router.post('/send/user/:userId', authenticate, auditSuccess('CREATE', 'push_notifications'), sendToUser)

/**
 * @swagger
 * /webpush/test:
 *   post:
 *     summary: "Send test push notification to current user"
 *     description: "Send a test push notification to the authenticated user."
 *     tags: [WebPush]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Test notification sent
 *       404:
 *         description: No subscription found
 *       500:
 *         description: Server error
 */
Router.post('/test', authenticate, auditSuccess('CREATE', 'push_notifications'), sendTest)

Router.use(auditError('webpush'));

module.exports = Router;
