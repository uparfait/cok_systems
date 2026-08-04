const Router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const getEventActions = require('../controllers/event_management/GetEventActionsController')
const getEventActionById = require('../controllers/event_management/GetEventActionByIdController')
const createEventAction = require('../controllers/event_management/CreateEventActionController')
const updateEventAction = require('../controllers/event_management/UpdateEventActionController')
const deleteEventAction = require('../controllers/event_management/DeleteEventActionController')
const getMyTasks = require('../controllers/event_management/GetMyTasksController')

const uploadsDir = path.join(__dirname, '../../uploads/tasks')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage })

Router.get('/', (req, res) => getEventActions.handle(req, res))
Router.get('/:id', (req, res) => getEventActionById.handle(req, res))
Router.post('/', upload.single('document'), (req, res) => createEventAction.handle(req, res))
Router.patch('/:id', upload.single('document'), (req, res) => updateEventAction.handle(req, res))
Router.delete('/:id', (req, res) => deleteEventAction.handle(req, res))

Router.post('/my-tasks/request-token', (req, res) => getMyTasks.requestToken(req, res))
Router.post('/my-tasks/verify-token', (req, res) => getMyTasks.verifyToken(req, res))

module.exports = Router