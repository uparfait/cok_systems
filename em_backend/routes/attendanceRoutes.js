const Router = require('express').Router();
const SubmitAttendanceController = require('../controllers/SubmitAttendanceController');
const GetAttendanceController = require('../controllers/GetAttendanceController');
const AttendanceMeController = require('../controllers/AttendanceMeController');
const SigningOptionsController = require('../controllers/SigningOptionsController');
const upload = require('../utilities/upload');

/**
 * @swagger
 * /attendance:
 *   post:
 *     summary: Submit event attendance
 *     tags: [Attendance]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               digitalCertificate:
 *                 type: string
 *                 format: binary
 *                 description: Optional digital certificate file (image/PDF)
 *   get:
 *     summary: Get attendance records
 *     tags: [Attendance]
 */
Router.post('/', upload.single('digitalCertificate'), (req, res, next) => {
  if (req.fileValidationError) {
    return res.status(400).json({ success: false, message: req.fileValidationError });
  }
  return SubmitAttendanceController.handle(req, res, next);
});
// Signed-in attendee's own account and signing status; must precede the list route
Router.get('/me', AttendanceMeController.handle);
// Whether the typed email has an account with a saved signature to show next to a certificate signature
Router.post('/signing-options', SigningOptionsController.handle);
Router.get('/', GetAttendanceController.handle);

module.exports = Router;