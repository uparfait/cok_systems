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
const addChecklist = require('../../controllers/task_management/add_subtask')
const updateChecklist = require('../../controllers/task_management/update_subtask')
const deleteChecklist = require('../../controllers/task_management/delete_subtask')
const createBoard = require('../../controllers/task_management/create_board')
const getBoards = require('../../controllers/task_management/get_boards')
const getBoardWithLists = require('../../controllers/task_management/get_board_with_lists')
const createList = require('../../controllers/task_management/create_list')
const moveTask = require('../../controllers/task_management/move_task')

const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/tasks')
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}
if (!fs.existsSync(path.join(uploadsDir, 'attachments'))) {
    fs.mkdirSync(path.join(uploadsDir, 'attachments'), { recursive: true })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'attachments') {
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
        fileSize: 1000000 * 10024 * 10024
    },
    fileFilter: (req, file, cb) => {
        cb(null, true)
    }
})

// Handle both single and multiple file uploads
const multiUpload = upload.fields([
    { name: 'attachments', maxCount: 3000 }
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

// Board management routes
Router.post('/boards/create', auditSuccess('CREATE', 'boards', (req, res, data) => `Created new board: ${data?.data?.name || 'unknown'}`), createBoard)
Router.get('/boards/list', auditSuccess('READ', 'boards'), getBoards)
Router.get('/boards/:boardId', auditSuccess('READ', 'boards'), getBoardWithLists)

// List management routes
Router.post('/boards/:boardId/lists', auditSuccess('CREATE', 'lists', (req, res, data) => `Created new list`), createList)

// Task CRUD routes
Router.get('/', auditSuccess('READ', 'tasks'), getTasks)
Router.get('/:id', auditSuccess('READ', 'tasks'), getTaskById)
Router.post('/', auditSuccess('CREATE', 'tasks', (req, res, data) => `Created new task: ${data?.data?.title || req.body.title || 'unknown'}`), createTask)
Router.put('/:id', auditSuccess('UPDATE', 'tasks', (req, res, data) => `Updated task: ${req.params.id}`), updateTask)
Router.put('/:id/status', auditSuccess('UPDATE', 'tasks', (req, res, data) => `Updated task status: ${req.params.id}`), updateTaskStatus)
Router.delete('/:id', auditSuccess('DELETE', 'tasks', (req, res, data) => `Deleted task: ${req.params.id}`), deleteTask)

// Task positioning/moving
Router.put('/:taskId/move', auditSuccess('UPDATE', 'tasks', (req, res, data) => `Moved task: ${req.params.taskId}`), moveTask)

// Comment management
Router.post('/:id/comments', auditSuccess('CREATE', 'task_comments', (req, res, data) => `Added comment to task: ${req.params.id}`), addComment)

// Attachment management
Router.post('/:id/attachments', auditSuccess('CREATE', 'task_attachments', (req, res, data) => `Added attachment to task: ${req.params.id}`), addAttachment)
Router.delete('/:id/attachments/:attachmentId', auditSuccess('DELETE', 'task_attachments', (req, res, data) => `Deleted attachment from task: ${req.params.id}`), deleteAttachment)

// Checklist management
Router.post('/:id/checklists', auditSuccess('CREATE', 'task_checklists', (req, res, data) => `Added checklist to task: ${req.params.id}`), addChecklist)
Router.put('/:id/checklists/:checklistId', auditSuccess('UPDATE', 'task_checklists', (req, res, data) => `Updated checklist: ${req.params.id}/${req.params.checklistId}`), updateChecklist)
Router.delete('/:id/checklists/:checklistId', auditSuccess('DELETE', 'task_checklists', (req, res, data) => `Deleted checklist: ${req.params.id}/${req.params.checklistId}`), deleteChecklist)

// Add error logging middleware
Router.use(auditError('tasks'))

module.exports = Router
