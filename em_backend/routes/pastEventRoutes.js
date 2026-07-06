const Router = require('express').Router();
const GetPastEventsController = require('../controllers/GetPastEventsController');

/**
 * @swagger
 * components:
 *   schemas:
 *     PastEvent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         eventName:
 *           type: string
 *           maxlength: 500
 *           example: "Q4 Planning Session"
 *         eventDescription:
 *           type: string
 *           maxlength: 2000
 *           example: "Quarterly planning session for Q4 objectives and resource allocation"
 *         eventType:
 *           type: string
 *           enum: [Special, Regular]
 *           example: "Special"
 *         eventRoom:
 *           type: string
 *           example: "Conference Room C"
 *         eventOrganizer:
 *           type: string
 *           example: "Operations Team"
 *         eventSpecialId:
 *           type: string
 *           example: "dd0e8400-e29b-41d4-a716-446655440008"
 *         startedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-10T09:00:00.000Z"
 *         expectedToEndAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-10T17:00:00.000Z"
 *         endedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-10T16:45:00.000Z"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-05T10:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-10T16:45:00.000Z"
 *     PastEventsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         totalRecords:
 *           type: number
 *           example: 500
 *         totalPages:
 *           type: number
 *           example: 25
 *         currentPage:
 *           type: number
 *           example: 1
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PastEvent'
 */

/**
 * @swagger
 * /events/past:
 *   get:
 *     summary: Retrieve past events with pagination, sorting, and filtering
 *     tags: [Past Events]
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
 *         example: 50
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [new, old]
 *           default: new
 *         description: Sort order by creation date
 *         example: "old"
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, thisWeek, thisMonth, thisYear]
 *         description: Filter events by time period
 *         example: "thisMonth"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering events
 *         example: "planning"
 *       - in: query
 *         name: searchField
 *         schema:
 *           type: string
 *           enum: [eventName, eventOrganizer, eventSpecialId]
 *         description: Field to search within
 *         example: "eventName"
 *     responses:
 *       200:
 *         description: Past events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PastEventsResponse'
 *             examples:
 *               historicalData:
 *                 value:
 *                   success: true
 *                   totalRecords: 3
 *                   totalPages: 1
 *                   currentPage: 1
 *                   data:
 *                     - _id: "60d5f484f1a2c8b1f8e4e1d1"
 *                       eventName: "Team Building Workshop"
 *                       eventDescription: "Annual team building and collaboration workshop"
 *                       eventType: "Regular"
 *                       eventRoom: "Activity Center"
 *                       eventOrganizer: "HR Department"
 *                       eventSpecialId: "ee0e8400-e29b-41d4-a716-446655440009"
 *                       startedAt: "2024-01-15T09:00:00.000Z"
 *                       expectedToEndAt: "2024-01-15T17:00:00.000Z"
 *                       endedAt: "2024-01-15T17:30:00.000Z"
 *                       createdAt: "2024-01-10T12:00:00.000Z"
 *                       updatedAt: "2024-01-15T17:30:00.000Z"
 *                     - _id: "60d5f484f1a2c8b1f8e4e1d2"
 *                       eventName: "Product Demo Day"
 *                       eventDescription: "Demonstration of new product features to stakeholders"
 *                       eventType: "Special"
 *                       eventRoom: "Demo Lab"
 *                       eventOrganizer: "Product Team"
 *                       eventSpecialId: "ff0e8400-e29b-41d4-a716-446655440010"
 *                       startedAt: "2024-01-20T10:00:00.000Z"
 *                       expectedToEndAt: "2024-01-20T12:00:00.000Z"
 *                       endedAt: "2024-01-20T11:45:00.000Z"
 *                       createdAt: "2024-01-18T09:00:00.000Z"
 *                       updatedAt: "2024-01-20T11:45:00.000Z"
 *                     - _id: "60d5f484f1a2c8b1f8e4e1d3"
 *                       eventName: "End of Year Celebration"
 *                       eventDescription: "Company-wide celebration for a successful year"
 *                       eventType: "Special"
 *                       eventRoom: "Grand Ballroom"
 *                       eventOrganizer: "Executive Team"
 *                       eventSpecialId: "gg0e8400-e29b-41d4-a716-446655440011"
 *                       startedAt: "2023-12-31T20:00:00.000Z"
 *                       expectedToEndAt: "2024-01-01T01:00:00.000Z"
 *                       endedAt: "2024-01-01T00:30:00.000Z"
 *                       createdAt: "2023-12-15T10:00:00.000Z"
 *                       updatedAt: "2024-01-01T00:30:00.000Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/', GetPastEventsController.handle);

module.exports = Router;