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

// Notification routes
Router.get('/', auditSuccess('READ', 'notifications'), getNotifications)
Router.post('/', auditSuccess('CREATE', 'notifications'), createNotification)
Router.put('/:id/read', auditSuccess('UPDATE', 'notifications', (req, res, data) => `Marked notification as read: ${req.params.id}`), markAsRead)
Router.put('/mark-all-read', auditSuccess('UPDATE', 'notifications', (req, res, data) => `Marked all notifications as read`), markAllAsRead)
Router.delete('/:id', auditSuccess('DELETE', 'notifications', (req, res, data) => `Deleted notification: ${req.params.id}`), deleteNotification)

// Add error logging middleware
Router.use(auditError('notifications'))

module.exports = Router