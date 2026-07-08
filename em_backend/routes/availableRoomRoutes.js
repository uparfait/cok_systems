const Router = require('express').Router();
const GetAvailableRoomsController = require('../controllers/GetAvailableRoomsController');

/**
 * @swagger
 * /rooms/available:
 *   get:
 *     summary: Get all available rooms for a requested time period and event mode
 *     tags: [Rooms]
 *     description: |
 *       Check availability for all active rooms simultaneously.
 *       Supports live, upcoming, and recurring event modes.
 *       For recurring events, provides per-date availability details.
 *     parameters:
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *         description: Start of the time period (ISO 8601)
 *         example: "2024-06-15T09:00:00.000Z"
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *         description: End of the time period (ISO 8601)
 *         example: "2024-06-15T17:00:00.000Z"
 *       - in: query
 *         name: eventMode
 *         schema:
 *           type: string
 *           enum: [live, upcoming, recurring]
 *         required: true
 *         description: Mode of the event being checked
 *         example: "live"
 *       - in: query
 *         name: excludeEventId
 *         schema:
 *           type: string
 *         description: Event special ID to exclude (prevents self-conflict when editing an event)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: query
 *         name: requestId
 *         schema:
 *           type: string
 *         description: Booking request ID to exclude (prevents self-conflict when editing a request)
 *         example: "60d5f484f1a2c8b1f8e4e1a1"
 *       - in: query
 *         name: recurringType
 *         schema:
 *           type: string
 *           enum: [Daily, Weekly, Monthly]
 *         description: Required when eventMode=recurring
 *         example: "Weekly"
 *       - in: query
 *         name: weeklyDays
 *         schema:
 *           type: string
 *         description: Comma-separated day numbers (0=Sun, 6=Sat). Required when recurringType=Weekly
 *         example: "1,3,5"
 *       - in: query
 *         name: monthlyDates
 *         schema:
 *           type: string
 *         description: Comma-separated day-of-month numbers. Required when monthlyPattern=specific or mixed
 *         example: "1,15"
 *       - in: query
 *         name: monthlyPattern
 *         schema:
 *           type: string
 *           enum: [specific, firstDay, lastDay, firstTwoWeeks, lastTwoWeeks, mixed]
 *         description: Required when eventMode=recurring and recurringType=Monthly
 *         example: "specific"
 *       - in: query
 *         name: eventStartTime
 *         schema:
 *           type: string
 *           pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$"
 *         description: Start time in HH:MM format. Required when eventMode=recurring
 *         example: "09:00"
 *       - in: query
 *         name: eventEndTime
 *         schema:
 *           type: string
 *           pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$"
 *         description: End time in HH:MM format. Required when eventMode=recurring
 *         example: "17:00"
 *       - in: query
 *         name: recurringEndDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for recurrence. Required when eventMode=recurring
 *         example: "2024-12-31T23:59:59.000Z"
 *     responses:
 *       200:
 *         description: Room availability check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All 5 active room(s) are available for the requested time period."
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestedPeriod:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                         end:
 *                           type: string
 *                           format: date-time
 *                     eventMode:
 *                       type: string
 *                       example: "live"
 *                     totalRooms:
 *                       type: integer
 *                       example: 5
 *                     availableCount:
 *                       type: integer
 *                       example: 3
 *                     unavailableCount:
 *                       type: integer
 *                       example: 2
 *                     availableRooms:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           room:
 *                             $ref: '#/components/schemas/Room'
 *                           available:
 *                             type: boolean
 *                             example: true
 *                           message:
 *                             type: string
 *                     unavailableRooms:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           room:
 *                             $ref: '#/components/schemas/Room'
 *                           available:
 *                             type: boolean
 *                             example: false
 *                           message:
 *                             type: string
 *                           conflicts:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 type:
 *                                   type: string
 *                                   example: "LiveEvent"
 *                                 eventName:
 *                                   type: string
 *                                 eventSpecialId:
 *                                   type: string
 *                     summary:
 *                       type: string
 *       400:
 *         description: Missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/', GetAvailableRoomsController.handle);

module.exports = Router;