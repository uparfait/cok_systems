const Router = require('express').Router();
const CreateEventActionController = require('../controllers/CreateEventActionController');
const GetEventActionsController = require('../controllers/GetEventActionsController');
const UpdateEventActionController = require('../controllers/UpdateEventActionController');
const DeleteEventActionController = require('../controllers/DeleteEventActionController');
const GetMyTasksController = require('../controllers/GetMyTasksController');
const GetEventActionByIdController = require('../controllers/GetEventActionByIdController');
const upload = require('../utilities/upload');
const rbac = require('../middlewares/rbac');

// Organizers manage actions from the public event pages (no bearer); a
// signed-in caller must be an event manager or the mayor.
const manageActionsIfSignedIn = rbac.requireLinksIfSignedIn('events', 'slug:mayor');

// specific routes before /:id wildcard
Router.post('/my-tasks/request-token', GetMyTasksController.requestToken);
Router.post('/my-tasks/verify-token', GetMyTasksController.verifyToken);

Router.get('/', GetEventActionsController.handle);
Router.get('/:id', GetEventActionByIdController.handle);
Router.post('/', manageActionsIfSignedIn, CreateEventActionController.handle);
Router.patch('/:id', manageActionsIfSignedIn, upload.fields([{ name: 'document', maxCount: 1 }, { name: 'documents', maxCount: 10 }]), UpdateEventActionController.handle);
Router.delete('/:id', manageActionsIfSignedIn, DeleteEventActionController.handle);

module.exports = Router;
