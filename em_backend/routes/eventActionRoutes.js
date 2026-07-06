const Router = require('express').Router();
const CreateEventActionController = require('../controllers/CreateEventActionController');
const GetEventActionsController = require('../controllers/GetEventActionsController');
const UpdateEventActionController = require('../controllers/UpdateEventActionController');
const DeleteEventActionController = require('../controllers/DeleteEventActionController');
const GetMyTasksController = require('../controllers/GetMyTasksController');
const GetEventActionByIdController = require('../controllers/GetEventActionByIdController');
const upload = require('../utilities/upload');

// specific routes before /:id wildcard
Router.post('/my-tasks/request-token', GetMyTasksController.requestToken);
Router.post('/my-tasks/verify-token', GetMyTasksController.verifyToken);

Router.get('/', GetEventActionsController.handle);
Router.get('/:id', GetEventActionByIdController.handle);
Router.post('/', CreateEventActionController.handle);
Router.patch('/:id', upload.single('document'), UpdateEventActionController.handle);
Router.delete('/:id', DeleteEventActionController.handle);

module.exports = Router;
