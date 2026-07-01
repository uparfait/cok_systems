const Router = require('express').Router();
const GetScheduledEventsController = require('../controllers/GetScheduledEventsController');

/**
 * @swagger
 * /events/scheduled:
 *   get:
 *     summary: Get all scheduled events (live, upcoming, recurring)
 *     tags: [Events]
 */
Router.get('/scheduled', GetScheduledEventsController.handle);

module.exports = Router;