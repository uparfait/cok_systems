/**
 * Routes for Task Management System
 */

const Router = require('express').Router()

// Import audit logging middleware
const { auditSuccess, auditError } = require('../../middlewares/audit')

/**
 * import all task controllers
 */
const createTask = require('../../controllers/task_management/create_task')
const getTasks = require('../../controllers/task_management/get_tasks')
const getTaskById = require('../../controllers/task_management/get_task_by_id')
const updateTask = require('../../controllers/task_management/update_task')
const updateTaskStatus = require('../../controllers/task_management/update_task_status')
const deleteTask = require('../../controllers/task_management/delete_task')
const addComment = require('../../controllers/task_management/add_comment')
const addAttachment = require('../../controllers/task_management/add_attachment')
const deleteAttachment = require('../../controllers/task_management/delete_attachment')
const addSubtask = require('../../controllers/task_management/add_subtask')
const updateSubtask = require('../../controllers/task_management/update_subtask')
const deleteSubtask = require('../../controllers/task_management/delete_subtask')

const multer = require('multer')
const upload = multer({
    storage: multer.memoryStorage(), // Store files in memory for processing
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
})

Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        console.warn('[TASK UPLOAD WARNING]: Handled unexpected or empty input:', error.message)
        req.body = req.body || {}
        return next()
    }
    next()
})

// Task CRUD routes
Router.get('/', auditSuccess('READ', 'tasks'), getTasks)
Router.get('/:id', auditSuccess('READ', 'tasks'), getTaskById)
Router.post('/', auditSuccess('CREATE', 'tasks', (req, res, data) => `Created new task: ${data?.data?.title || req.body.title || 'unknown'}`), createTask)
Router.put('/:id', auditSuccess('UPDATE', 'tasks', (req, res, data) => `Updated task: ${req.params.id}`), updateTask)
Router.put('/:id/status', auditSuccess('UPDATE', 'tasks', (req, res, data) => `Updated task status: ${req.params.id}`), updateTaskStatus)
Router.delete('/:id', auditSuccess('DELETE', 'tasks', (req, res, data) => `Deleted task: ${req.params.id}`), deleteTask)

// Comment management
Router.post('/:id/comments', auditSuccess('CREATE', 'task_comments', (req, res, data) => `Added comment to task: ${req.params.id}`), addComment)

// Attachment management
Router.post('/:id/attachments', auditSuccess('CREATE', 'task_attachments', (req, res, data) => `Added attachment to task: ${req.params.id}`), addAttachment)
Router.delete('/:id/attachments/:attachmentId', auditSuccess('DELETE', 'task_attachments', (req, res, data) => `Deleted attachment from task: ${req.params.id}`), deleteAttachment)

// Subtask management
Router.post('/:id/subtasks', auditSuccess('CREATE', 'task_subtasks', (req, res, data) => `Added subtask to task: ${req.params.id}`), addSubtask)
Router.put('/:id/subtasks/:subtaskId', auditSuccess('UPDATE', 'task_subtasks', (req, res, data) => `Updated subtask: ${req.params.id}/${req.params.subtaskId}`), updateSubtask)
Router.delete('/:id/subtasks/:subtaskId', auditSuccess('DELETE', 'task_subtasks', (req, res, data) => `Deleted subtask: ${req.params.id}/${req.params.subtaskId}`), deleteSubtask)

// Add error logging middleware
Router.use(auditError('tasks'))

module.exports = Router