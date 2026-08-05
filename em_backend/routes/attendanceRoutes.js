const Router = require('express').Router();
const SubmitAttendanceController = require('../controllers/SubmitAttendanceController');
const GetAttendanceController = require('../controllers/GetAttendanceController');
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
Router.get('/', GetAttendanceController.handle);

module.exports = Router;