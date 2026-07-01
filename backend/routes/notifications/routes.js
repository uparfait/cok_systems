/**
 * Routes for Notification Management System
 */

const Router = require('express').Router()

// Import audit logging middleware
const { auditSuccess, auditError } = require('../../middlewares/audit')

/**
 * import all notification controllers
 */
const getNotifications = require('../../controllers/notifications/get_notifications')
const markAsRead = require('../../controllers/notifications/mark_as_read')
const markAllAsRead = require('../../controllers/notifications/mark_all_as_read')
const createNotification = require('../../controllers/notifications/create_notification')
const deleteNotification = require('../../controllers/notifications/delete_notification')

const multer = require('multer')
const upload = multer()

Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        console.warn('[NOTIFICATION UPLOAD WARNING]: Handled unexpected or empty input:', error.message)
        req.body = req.body || {}
        return next()
    }
    next()
})

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: "Get user notifications"
 *     description: "Retrieve notifications for the authenticated user with pagination."
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         example: 20
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: "Filter to show only unread notifications"
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       type:
 *                         type: string
 *                       is_read:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       500:
 *         description: Internal server error
 */
Router.get('/', auditSuccess('READ', 'notifications'), getNotifications)

/**
 * @swagger
 * /notifications:
 *   post:
 *     summary: "Create a notification"
 *     description: "Create a new notification for a user. Used by the system to send alerts and reminders."
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - title
 *               - message
 *             properties:
 *               user:
 *                 type: string
 *                 description: "Recipient user's MongoDB ObjectId"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               title:
 *                 type: string
 *                 description: "Notification title"
 *                 example: "Task Due Reminder"
 *               message:
 *                 type: string
 *                 description: "Notification message content"
 *                 example: "Your task 'Submit Annual Report' is due in 24 hours."
 *               type:
 *                 type: string
 *                 description: "Notification type"
 *                 example: "deadline_reminder"
 *               task:
 *                 type: string
 *                 description: "Related task ID (optional)"
 *     responses:
 *       201:
 *         description: Notification created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
Router.post('/', auditSuccess('CREATE', 'notifications'), createNotification)

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: "Mark notification as read"
 *     description: "Mark a single notification as read by its ID."
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Notification MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id/read', auditSuccess('UPDATE', 'notifications', (req, res, data) => `Marked notification as read: ${req.params.id}`), markAsRead)

/**
 * @swagger
 * /notifications/mark-all-read:
 *   put:
 *     summary: "Mark all notifications as read"
 *     description: "Mark all unread notifications for the authenticated user as read."
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       500:
 *         description: Internal server error
 */
Router.put('/mark-all-read', auditSuccess('UPDATE', 'notifications', (req, res, data) => `Marked all notifications as read`), markAllAsRead)

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: "Delete a notification"
 *     description: "Delete a single notification by its ID."
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Notification MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/:id', auditSuccess('DELETE', 'notifications', (req, res, data) => `Deleted notification: ${req.params.id}`), deleteNotification)

// Add error logging middleware
Router.use(auditError('notifications'))

module.exports = Router