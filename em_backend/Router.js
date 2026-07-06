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
const GenerateRoomQrCodeController = require('./controllers/GenerateRoomQrCodeController');
const SectionUpdate = require('./controllers/EventSectionUpdateController');

// Mount all routes
Router.use('/rooms/available', availableRoomRoutes);

// Room QR code route must come before catch-all /rooms/:id
Router.get('/rooms/:roomName/qrcode', GenerateRoomQrCodeController.handle);

Router.use('/rooms', roomRetrievalRoutes);
Router.use('/rooms', roomRoutes);
Router.use('/events', eventRoutes);
Router.use('/events', qrcodeRoutes);
Router.use('/events', scheduledEventRoutes);
Router.use('/events', postMeetingMinutesRoutes);
Router.use('/events/live', liveEventRoutes);
Router.use('/events/upcoming', upcomingEventRoutes);
Router.use('/events/recurring', recurringEventRoutes);
Router.use('/events/past', pastEventRoutes);
Router.use('/attendance', attendanceRoutes);
Router.use('/event-actions', eventActionRoutes);
Router.use('/events', eventManagementRoutes);
Router.put('/events/section-update', SectionUpdate.handle);

// Attendance export
const ExportAttendanceController = require('./controllers/ExportAttendanceController');
Router.get('/attendance/export', ExportAttendanceController.handle);

// Invite routes
const inviteRoutes = require('./routes/inviteRoutes');
Router.use('/events', inviteRoutes);

// Booking Request routes
Router.use('/booking-requests', bookingRequestRoutes);

module.exports = Router;
