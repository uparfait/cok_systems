const Router = require('express').Router();
const bookingRequestRoutes = require('./routes/bookingRequestRoutes');
const roomRoutes = require('./routes/roomRoutes');
const eventRoutes = require('./routes/eventRoutes');
const liveEventRoutes = require('./routes/liveEventRoutes');
const upcomingEventRoutes = require('./routes/upcomingEventRoutes');
const recurringEventRoutes = require('./routes/recurringEventRoutes');
const pastEventRoutes = require('./routes/pastEventRoutes');
const roomRetrievalRoutes = require('./routes/roomRetrievalRoutes');
const availableRoomRoutes = require('./routes/availableRoomRoutes');
const qrcodeRoutes = require('./routes/qrcodeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const scheduledEventRoutes = require('./routes/scheduledEventRoutes');
const eventActionRoutes = require('./routes/eventActionRoutes');
const postMeetingMinutesRoutes = require('./routes/postMeetingMinutesRoutes');
const eventManagementRoutes = require('./routes/eventManagementRoutes');
const eventAccessRoutes = require('./routes/eventAccessRoutes');
const GenerateRoomQrCodeController = require('./controllers/GenerateRoomQrCodeController');
const SectionUpdate = require('./controllers/EventSectionUpdateController');
const eventAccessAuth = require('./middlewares/eventAccessAuth');
const rbac = require('./middlewares/rbac');

// Role-based access (see middlewares/rbac.js): a signed-in caller's bearer
// must always be a valid session; dashboard-only management routes require
// the events/rooms/booking-requests links; routes shared with the public
// organizer flows enforce the links only when a bearer is actually sent.
Router.use(rbac.validateBearerIfPresent);

// Co-organizer routes (before the /events routers so the specific path wins)
const CoOrganizerController = require('./controllers/CoOrganizerController');
Router.get('/events/:eventSpecialId/co-organizers', CoOrganizerController.list);
Router.post('/events/:eventSpecialId/co-organizers', rbac.requireLinksIfSignedIn('events'), CoOrganizerController.add);
Router.put('/events/:eventSpecialId/co-organizers/:email', rbac.requireLinksIfSignedIn('events'), CoOrganizerController.update);
Router.delete('/events/:eventSpecialId/co-organizers/:email', rbac.requireLinksIfSignedIn('events'), CoOrganizerController.remove);

// Mount all routes
Router.use('/rooms/available', availableRoomRoutes);

// Room QR code route must come before catch-all /rooms/:id
Router.get('/rooms/:roomName/qrcode', rbac.requireLinks('rooms', 'events'), GenerateRoomQrCodeController.handle);

Router.use('/rooms', roomRetrievalRoutes);
Router.use('/rooms', roomRoutes);
Router.use('/events', eventRoutes);
Router.use('/events', eventAccessAuth, qrcodeRoutes);
Router.use('/events', scheduledEventRoutes);
Router.use('/events', postMeetingMinutesRoutes);
Router.use('/events/live', eventAccessAuth, liveEventRoutes);
Router.use('/events/upcoming', upcomingEventRoutes);
Router.use('/events/recurring', recurringEventRoutes);
Router.use('/events/past', pastEventRoutes);
Router.use('/attendance', eventAccessAuth, attendanceRoutes);
Router.use('/event-actions', eventActionRoutes);
Router.use('/events', eventManagementRoutes);
Router.put('/events/section-update', rbac.requireLinksIfSignedIn('events'), SectionUpdate.handle);

// Attendance export (event-manager dashboard only)
const ExportAttendanceController = require('./controllers/ExportAttendanceController');
Router.get('/attendance/export', rbac.requireLinks('events'), ExportAttendanceController.handle);

// Dashboard routes
const dashboardRoutes = require('./routes/dashboardRoutes');
Router.use('/events', dashboardRoutes);

// Invite routes
const inviteRoutes = require('./routes/inviteRoutes');
Router.use('/events', inviteRoutes);

// Booking Request routes
Router.use('/booking-requests', bookingRequestRoutes);

// Event access routes
Router.use('/event-access', eventAccessRoutes);

module.exports = Router;
