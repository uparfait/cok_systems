const Router = require('express').Router();
const GetDashboardStatsController = require('../controllers/GetDashboardStatsController');
const GetCalendarEventsController = require('../controllers/GetCalendarEventsController');
const rbac = require('../middlewares/rbac');

// The dashboard figures belong to the event-manager dashboard; the calendar
// feeds every signed-in role's calendar page and the public booking form.
// The mayor's events page reads the same figures as the event-manager
// dashboard, so its slug is accepted here too.
Router.get('/stats', rbac.requireLinks('events', 'rooms', 'booking-requests', 'slug:mayor'), GetDashboardStatsController.handle);
Router.get('/calendar', GetCalendarEventsController.handle);
Router.get('/calendar/availability', GetCalendarEventsController.availability);

module.exports = Router;
