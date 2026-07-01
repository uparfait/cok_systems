const Router = require('express').Router();
const SubmitAttendanceController = require('../controllers/SubmitAttendanceController');
const GetAttendanceController = require('../controllers/GetAttendanceController');

/**
 * @swagger
 * /attendance:
 *   post:
 *     summary: Submit event attendance
 *     tags: [Attendance]
 *   get:
 *     summary: Get attendance records
 *     tags: [Attendance]
 */
Router.post('/', SubmitAttendanceController.handle);
Router.get('/', GetAttendanceController.handle);

module.exports = Router;