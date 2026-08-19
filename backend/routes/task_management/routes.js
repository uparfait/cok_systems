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

/**
 * @swagger
 * /tasks/boards/create:
 *   post:
 *     summary: "Create a new board"
 *     description: "Create a new Kanban board for task management with a name, description, and optional background."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: "Board name"
 *                 example: "Service Delivery Tasks"
 *               description:
 *                 type: string
 *                 description: "Board description"
 *                 example: "Tasks related to service delivery department"
 *               background:
 *                 type: string
 *                 description: "Background color or image URL"
 *                 example: "#1a1a2e"
 *               visibility:
 *                 type: string
 *                 enum: [public, private, team]
 *                 example: "team"
 *     responses:
 *       201:
 *         description: Board created successfully
 *       400:
 *         description: Board name is required
 *       500:
 *         description: Internal server error
 */
Router.post('/boards/create', auditSuccess('CREATE', 'boards', (req, res, data) => `Created new board: ${data?.data?.name || 'unknown'}`), createBoard)

/**
 * @swagger
 * /tasks/boards/list:
 *   get:
 *     summary: "Get all boards"
 *     description: "Retrieve a list of all Kanban boards the user has access to."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         example: 0
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         example: 20
 *     responses:
 *       200:
 *         description: Boards retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/boards/list', auditSuccess('READ', 'boards'), getBoards)

/**
 * @swagger
 * /tasks/boards/{boardId}:
 *   get:
 *     summary: "Get board with lists"
 *     description: "Retrieve a single board with all its lists and tasks."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: boardId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Board MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Board with lists retrieved successfully
 *       404:
 *         description: Board not found
 *       500:
 *         description: Internal server error
 */
Router.get('/boards/:boardId', auditSuccess('READ', 'boards'), getBoardWithLists)

/**
 * @swagger
 * /tasks/boards/{boardId}/lists:
 *   post:
 *     summary: "Create a list in a board"
 *     description: "Create a new list (column) within a Kanban board."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: boardId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Board MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: "List name"
 *                 example: "In Progress"
 *               color:
 *                 type: string
 *                 description: "List color"
 *                 example: "#ff6b6b"
 *     responses:
 *       201:
 *         description: List created successfully
 *       400:
 *         description: List name is required
 *       404:
 *         description: Board not found
 *       500:
 *         description: Internal server error
 */
Router.post('/boards/:boardId/lists', auditSuccess('CREATE', 'lists', (req, res, data) => `Created new list`), createList)

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: "Get all tasks"
 *     description: "Retrieve tasks with optional filtering by status, priority, assignee, and title search."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [To-do, In-progress, Under-review, Completed]
 *         description: "Filter by task status"
 *         example: "In-progress"
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High, Urgent]
 *         description: "Filter by priority"
 *       - in: query
 *         name: incharge
 *         schema:
 *           type: string
 *         description: "Filter by assignee (incharge) user ID"
 *       - in: query
 *         name: title
 *         schema:
 *           type: string
 *         description: "Search by title (case-insensitive)"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: "createdAt"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: "desc"
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/', auditSuccess('READ', 'tasks'), getTasks)

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: "Create a new task"
 *     description: "Create a new task with title, description, assignee, priority, due date, and optional attachments."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - incharge
 *             properties:
 *               title:
 *                 type: string
 *                 description: "Task title"
 *                 example: "Process building permit application #2026-001"
 *               description:
 *                 type: string
 *                 description: "Task description"
 *                 example: "Review and process the building permit application submitted by Mukamana Alice"
 *               incharge:
 *                 type: string
 *                 description: "User ID of the person assigned to this task"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               board:
 *                 type: string
 *                 description: "Board MongoDB ObjectId"
 *               list:
 *                 type: string
 *                 description: "List MongoDB ObjectId"
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High, Urgent]
 *                 example: "High"
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 description: "Due date (YYYY-MM-DD)"
 *                 example: "2026-07-15"
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: "Array of user IDs for task members"
 *               watchers:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: "Array of user IDs for task watchers"
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: "File attachments"
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
Router.post('/', auditSuccess('CREATE', 'tasks', (req, res, data) => `Created new task: ${data?.data?.title || req.body.title || 'unknown'}`), createTask)

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: "Get task by ID"
 *     description: "Retrieve a single task with all its details including comments, attachments, and checklists."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Task details retrieved successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
Router.get('/:id', auditSuccess('READ', 'tasks'), getTaskById)

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: "Update a task"
 *     description: "Update task details including title, description, priority, due date, assignee, and other fields."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Updated task title"
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High, Urgent]
 *               dueDate:
 *                 type: string
 *                 format: date
 *               incharge:
 *                 type: string
 *               board:
 *                 type: string
 *               list:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id', auditSuccess('UPDATE', 'tasks', (req, res, data) => `Updated task: ${data?.data?.title || req.body.title || req.params.id}`), updateTask)

/**
 * @swagger
 * /tasks/{id}/status:
 *   put:
 *     summary: "Update task status"
 *     description: "Update the status of a task. Status values: To-do, In-progress, Under-review, Completed."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [To-do, In-progress, Under-review, Completed]
 *                 description: "New task status"
 *                 example: "Completed"
 *     responses:
 *       200:
 *         description: Task status updated successfully
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id/status', auditSuccess('UPDATE', 'tasks', (req, res, data) => `Updated task status${req.body.status ? ` to ${req.body.status}` : ''}: ${data?.data?.title || req.body.title || req.params.id}`), updateTaskStatus)

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: "Delete a task"
 *     description: "Permanently delete a task by its MongoDB ObjectId."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/:id', auditSuccess('DELETE', 'tasks', (req, res, data) => `Deleted task: ${data?.data?.title || req.params.id}`), deleteTask)

/**
 * @swagger
 * /tasks/{taskId}/move:
 *   put:
 *     summary: "Move task to another list"
 *     description: "Move a task to a different list (column) within the same board or to a different board."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - listId
 *             properties:
 *               listId:
 *                 type: string
 *                 description: "Target list MongoDB ObjectId"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               boardId:
 *                 type: string
 *                 description: "Target board MongoDB ObjectId (optional, for moving between boards)"
 *               position:
 *                 type: integer
 *                 description: "Position index within the list"
 *     responses:
 *       200:
 *         description: Task moved successfully
 *       404:
 *         description: Task or list not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:taskId/move', auditSuccess('UPDATE', 'tasks', (req, res, data) => `Moved task: ${req.params.taskId}`), moveTask)

/**
 * @swagger
 * /tasks/{id}/comments:
 *   post:
 *     summary: "Add a comment to a task"
 *     description: "Add a comment to a task. Supports text content and optional file attachments."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: "Comment text"
 *                 example: "I have reviewed the application and it looks good. Proceeding with approval."
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
Router.post('/:id/comments', auditSuccess('CREATE', 'task_comments', (req, res, data) => `Added comment to task: ${data?.data?.title || req.params.id}`), addComment)

/**
 * @swagger
 * /tasks/{id}/attachments:
 *   post:
 *     summary: "Add attachment to a task"
 *     description: "Upload and attach files to a task."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: "Files to attach"
 *     responses:
 *       201:
 *         description: Attachments added successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
Router.post('/:id/attachments', auditSuccess('CREATE', 'task_attachments', (req, res, data) => `Added attachment to task: ${data?.data?.title || req.params.id}`), addAttachment)

/**
 * @swagger
 * /tasks/{id}/attachments/{attachmentId}:
 *   delete:
 *     summary: "Delete attachment from task"
 *     description: "Remove a specific file attachment from a task."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Attachment MongoDB ObjectId"
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 *       404:
 *         description: Task or attachment not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/:id/attachments/:attachmentId', auditSuccess('DELETE', 'task_attachments', (req, res, data) => `Deleted attachment from task: ${data?.data?.title || req.params.id}`), deleteAttachment)

/**
 * @swagger
 * /tasks/{id}/checklists:
 *   post:
 *     summary: "Add checklist item to task"
 *     description: "Add a checklist (subtask) item to a task."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: "Checklist item title"
 *                 example: "Verify all required documents"
 *               assignedTo:
 *                 type: string
 *                 description: "User ID to assign this checklist item to"
 *     responses:
 *       201:
 *         description: Checklist item added successfully
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
Router.post('/:id/checklists', auditSuccess('CREATE', 'task_checklists', (req, res, data) => `Added checklist to task: ${data?.data?.title || req.params.id}`), addChecklist)

/**
 * @swagger
 * /tasks/{id}/checklists/{checklistId}:
 *   put:
 *     summary: "Update checklist item"
 *     description: "Update a checklist item's title, completion status, or assigned user."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Checklist item MongoDB ObjectId"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               isCompleted:
 *                 type: boolean
 *               assignedTo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checklist item updated successfully
 *       404:
 *         description: Task or checklist item not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id/checklists/:checklistId', auditSuccess('UPDATE', 'task_checklists', (req, res, data) => `Updated checklist ${req.body.title ? `"${req.body.title}" ` : ''}on task: ${data?.data?.title || req.params.id}`), updateChecklist)

/**
 * @swagger
 * /tasks/{id}/checklists/{checklistId}:
 *   delete:
 *     summary: "Delete checklist item"
 *     description: "Remove a checklist item from a task."
 *     tags: [Task Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Task MongoDB ObjectId"
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Checklist item MongoDB ObjectId"
 *     responses:
 *       200:
 *         description: Checklist item deleted successfully
 *       404:
 *         description: Task or checklist item not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/:id/checklists/:checklistId', auditSuccess('DELETE', 'task_checklists', (req, res, data) => `Deleted checklist from task: ${data?.data?.title || req.params.id}`), deleteChecklist)

// Add error logging middleware
Router.use(auditError('tasks'))

module.exports = Router