const Router = require('express').Router();
const GetRecurringEventsController = require('../controllers/GetRecurringEventsController');

/**
 * @swagger
 * components:
 *   schemas:
 *     RecurringEvent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         eventName:
 *           type: string
 *           maxlength: 500
 *           example: "Weekly Team Training"
 *         eventDescription:
 *           type: string
 *           maxlength: 2000
 *           example: "Weekly technical training session covering new technologies and best practices"
 *         eventType:
 *           type: string
 *           enum: [Special, Regular]
 *           example: "Regular"
 *         eventRoom:
 *           type: string
 *           example: "Training Room A"
 *         eventOrganizer:
 *           type: string
 *           example: "Learning & Development"
 *         eventSpecialId:
 *           type: string
 *           example: "aa0e8400-e29b-41d4-a716-446655440005"
 *         eventStartDate:
 *           type: string
 *           format: date-time
 *           example: "2024-01-01T00:00:00.000Z"
 *         eventEndDate:
 *           type: string
 *           format: date-time
 *           example: "2024-12-31T23:59:59.000Z"
 *         eventRecurring:
 *           type: object
 *           properties:
 *             isRecurring:
 *               type: boolean
 *               example: true
 *             recurringType:
 *               type: string
 *               enum: [Daily, Weekly, Monthly]
 *               example: "Weekly"
 *             recurringEndDate:
 *               type: string
 *               format: date-time
 *               example: "2024-12-31T23:59:59.000Z"
 *             weeklyDays:
 *               type: array
 *               items:
 *                 type: number
 *               example: [2, 4]
 *             monthlyDates:
 *               type: array
 *               items:
 *                 type: number
 *               example: null
 *             monthlyPattern:
 *               type: string
 *               example: "specific"
 *             dailyStartTime:
 *               type: string
 *               example: null
 *             dailyEndTime:
 *               type: string
 *               example: null
 *             willExpire:
 *               type: boolean
 *               example: true
 *             willExpireAt:
 *               type: string
 *               format: date-time
 *               example: "2024-12-31T23:59:59.000Z"
 *             isExpired:
 *               type: boolean
 *               example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-01T08:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00.000Z"
 *     RecurringEventsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         totalRecords:
 *           type: number
 *           example: 25
 *         totalPages:
 *           type: number
 *           example: 2
 *         currentPage:
 *           type: number
 *           example: 1
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RecurringEvent'
 */

/**
 * @swagger
 * /events/recurring:
 *   get:
 *     summary: Retrieve recurring events with pagination, sorting, and filtering
 *     tags: [Recurring Events]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of records per page
 *         example: 15
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [new, old]
 *           default: new
 *         description: Sort order by creation date
 *         example: "new"
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, thisWeek, thisMonth, thisYear]
 *         description: Filter events by time period
 *         example: "thisYear"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering events
 *         example: "training"
 *       - in: query
 *         name: searchField
 *         schema:
 *           type: string
 *           enum: [eventName, eventOrganizer, eventSpecialId]
 *         description: Field to search within
 *         example: "eventOrganizer"
 *     responses:
 *       200:
 *         description: Recurring events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecurringEventsResponse'
 *             examples:
 *               dailyEvent:
 *                 value:
 *                   success: true
 *                   totalRecords: 2
 *                   totalPages: 1
 *                   currentPage: 1
 *                   data:
 *                     - _id: "60d5f484f1a2c8b1f8e4e1c1"
 *                       eventName: "Daily Standup"
 *                       eventDescription: "Daily team synchronization meeting"
 *                       eventType: "Regular"
 *                       eventRoom: "Scrum Room 1"
 *                       eventOrganizer: "Development Team"
 *                       eventSpecialId: "bb0e8400-e29b-41d4-a716-446655440006"
 *                       eventStartDate: "2024-01-01T00:00:00.000Z"
 *                       eventEndDate: "2024-12-31T23:59:59.000Z"
 *                       eventRecurring:
 *                         isRecurring: true
 *                         recurringType: "Daily"
 *                         recurringEndDate: "2024-12-31T23:59:59.000Z"
 *                         dailyStartTime: "09:00"
 *                         dailyEndTime: "09:30"
 *                         willExpire: false
 *                         isExpired: false
 *                       createdAt: "2024-01-01T07:00:00.000Z"
 *                       updatedAt: "2024-01-01T07:00:00.000Z"
 *                     - _id: "60d5f484f1a2c8b1f8e4e1c2"
 *                       eventName: "Monthly Review Meeting"
 *                       eventDescription: "Monthly performance review and planning session"
 *                       eventType: "Regular"
 *                       eventRoom: "Board Room"
 *                       eventOrganizer: "Management Team"
 *                       eventSpecialId: "cc0e8400-e29b-41d4-a716-446655440007"
 *                       eventStartDate: "2024-02-01T00:00:00.000Z"
 *                       eventEndDate: "2024-12-31T23:59:59.000Z"
 *                       eventRecurring:
 *                         isRecurring: true
 *                         recurringType: "Monthly"
 *                         recurringEndDate: "2024-12-31T23:59:59.000Z"
 *                         monthlyDates: [1]
 *                         monthlyPattern: "firstDay"
 *                         willExpire: true
 *                         willExpireAt: "2024-12-31T23:59:59.000Z"
 *                         isExpired: false
 *                       createdAt: "2024-02-01T08:00:00.000Z"
 *                       updatedAt: "2024-02-01T08:00:00.000Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/', GetRecurringEventsController.handle);

module.exports = Router;