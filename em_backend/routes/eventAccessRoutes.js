const Router = require('express').Router();
const EventAccessController = require('../controllers/EventAccessController');

Router.post('/request-token', EventAccessController.requestToken);
Router.post('/verify-token', EventAccessController.verifyToken);
Router.post('/validate', EventAccessController.validate);

module.exports = Router;
