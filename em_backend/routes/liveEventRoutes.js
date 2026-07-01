const Router = require('express').Router();
const GetLiveEventsController = require('../controllers/GetLiveEventsController');

/**
 * @swagger
 * components:
 *   schemas:
 *     LiveEvent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         eventName:
 *           type: string
 *           maxlength: 500
 *           example: "Team Standup Meeting"
 *         eventDescription:
 *           type: string
 *           maxlength: 2000
 *           example: "Daily team standup to discuss progress and blockers"
 *         eventType:
 *           type: string
 *           enum: [Special, Regular]
 *           example: "Regular"
 *         eventRoom:
 *           type: string
 *           example: "Conference Room A"
 *         eventOrganizer:
 *           type: string
 *           example: "Sarah Johnson"
 *         eventSpecialId:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         startedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-02-15T09:00:00.000Z"
 *         willEndAt:
 *           type: string
 *           format: date-time
 *           example: "2024-02-15T10:00:00.000Z"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-02-15T08:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-02-15T08:30:00.000Z"
 *     LiveEventsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         totalRecords:
 *           type: number
 *           example: 150
 *         totalPages:
 *           type: number
 *           example: 8
 *         currentPage:
 *           type: number
 *           example: 1
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LiveEvent'
 */

/**
 * @swagger
 * /events/live:
 *   get:
 *     summary: Retrieve live events with pagination, sorting, and filtering
 *     tags: [Live Events]
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
 *         example: 20
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
 *         example: "thisWeek"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering events
 *         example: "meeting"
 *       - in: query
 *         name: searchField
 *         schema:
 *           type: string
 *           enum: [eventName, eventOrganizer, eventSpecialId]
 *         description: Field to search within
 *         example: "eventName"
 *     responses:
 *       200:
 *         description: Live events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LiveEventsResponse'
 *             examples:
 *               withData:
 *                 value:
 *                   success: true
 *                   totalRecords: 3
 *                   totalPages: 1
 *                   currentPage: 1
 *                   data:
 *                     - _id: "60d5f484f1a2c8b1f8e4e1a1"
 *                       eventName: "Team Standup Meeting"
 *                       eventDescription: "Daily team standup to discuss progress"
 *                       eventType: "Regular"
 *                       eventRoom: "Conference Room A"
 *                       eventOrganizer: "Sarah Johnson"
 *                       eventSpecialId: "550e8400-e29b-41d4-a716-446655440000"
 *                       startedAt: "2024-02-15T09:00:00.000Z"
 *                       willEndAt: "2024-02-15T10:00:00.000Z"
 *                       createdAt: "2024-02-15T08:00:00.000Z"
 *                       updatedAt: "2024-02-15T08:30:00.000Z"
 *                     - _id: "60d5f484f1a2c8b1f8e4e1a2"
 *                       eventName: "Client Presentation"
 *                       eventDescription: "Quarterly client presentation and review"
 *                       eventType: "Special"
 *                       eventRoom: "Board Room"
 *                       eventOrganizer: "Mike Brown"
 *                       eventSpecialId: "660e8400-e29b-41d4-a716-446655440001"
 *                       startedAt: "2024-02-15T11:00:00.000Z"
 *                       willEndAt: "2024-02-15T12:30:00.000Z"
 *                       createdAt: "2024-02-15T09:00:00.000Z"
 *                       updatedAt: "2024-02-15T09:00:00.000Z"
 *               empty:
 *                 value:
 *                   success: true
 *                   totalRecords: 0
 *                   totalPages: 0
 *                   currentPage: 1
 *                   data: []
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/', GetLiveEventsController.handle);

module.exports = Router;