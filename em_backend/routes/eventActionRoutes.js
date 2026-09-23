const Router = require('express').Router();
const CreateEventActionController = require('../controllers/CreateEventActionController');
const GetEventActionsController = require('../controllers/GetEventActionsController');
const UpdateEventActionController = require('../controllers/UpdateEventActionController');
const DeleteEventActionController = require('../controllers/DeleteEventActionController');
const GetMyTasksController = require('../controllers/GetMyTasksController');
const GetEventActionByIdController = require('../controllers/GetEventActionByIdController');
const upload = require('../utilities/upload');
const rbac = require('../middlewares/rbac');

// Organizers manage actions from the public event pages (no bearer). A
// signed-in caller must be an event manager, the mayor, or a holder of the
// task-manager link: the Follow-ups board of the task manager is built on
// these same event actions, so every role that can open that page has to
// be able to create and update one.
const manageActionsIfSignedIn = rbac.requireLinksIfSignedIn('events', 'task-manager', 'slug:mayor');

// specific routes before /:id wildcard
Router.post('/my-tasks/request-token', GetMyTasksController.requestToken);
Router.post('/my-tasks/verify-token', GetMyTasksController.verifyToken);

Router.get('/', GetEventActionsController.handle);
Router.get('/:id', GetEventActionByIdController.handle);
Router.post('/', manageActionsIfSignedIn, CreateEventActionController.handle);
Router.patch('/:id', manageActionsIfSignedIn, upload.fields([{ name: 'document', maxCount: 1 }, { name: 'documents', maxCount: 10 }]), UpdateEventActionController.handle);
Router.delete('/:id', manageActionsIfSignedIn, DeleteEventActionController.handle);

module.exports = Router;
