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
const path = require('path')
const fs = require('fs')

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/tasks')
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}
if (!fs.existsSync(path.join(uploadsDir, 'covers'))) {
    fs.mkdirSync(path.join(uploadsDir, 'covers'), { recursive: true })
}
if (!fs.existsSync(path.join(uploadsDir, 'attachments'))) {
    fs.mkdirSync(path.join(uploadsDir, 'attachments'), { recursive: true })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'coverImage') {
            cb(null, path.join(uploadsDir, 'covers'))
        } else if (file.fieldname === 'attachments') {
            cb(null, path.join(uploadsDir, 'attachments'))
        } else {
            cb(null, uploadsDir)
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
})

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit per file
    },
    fileFilter: (req, file, cb) => {
        // Allow various file types
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', 'text/csv',
            'video/mp4', 'video/avi', 'video/mov'
        ]

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error('Invalid file type'), false)
        }
    }
})

// Handle both single and multiple file uploads
const multiUpload = upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'attachments', maxCount: 10 } // Allow up to 10 attachments
])

Router.use(multiUpload)

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