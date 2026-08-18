const Router = require('express').Router();
const GetDashboardStatsController = require('../controllers/GetDashboardStatsController');
const GetCalendarEventsController = require('../controllers/GetCalendarEventsController');

Router.get('/stats', GetDashboardStatsController.handle);
Router.get('/calendar', GetCalendarEventsController.handle);
Router.get('/calendar/availability', GetCalendarEventsController.availability);

module.exports = Router;
