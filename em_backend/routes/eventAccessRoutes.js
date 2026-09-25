const Router = require('express').Router();
const EventAccessController = require('../controllers/EventAccessController');

// Tried first by the event cards: a signed-in organizer or co-organizer
// gets in without the email step. Answers { success: false } for everyone
// else, saying nothing about why.
Router.post('/auto-token', EventAccessController.autoToken);
Router.post('/request-token', EventAccessController.requestToken);
Router.post('/verify-token', EventAccessController.verifyToken);
Router.post('/validate', EventAccessController.validate);

module.exports = Router;
