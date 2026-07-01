const Router = require('express').Router();
const GetUpcomingEventsController = require('../controllers/GetUpcomingEventsController');

/**
 * @swagger
 * components:
 *   schemas:
 *     UpcomingEvent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         eventName:
 *           type: string
 *           maxlength: 500
 *           example: "Annual Tech Conference 2024"
 *         eventDescription:
 *           type: string
 *           maxlength: 2000
 *           example: "A comprehensive technology conference featuring keynote speakers and workshops"
 *         eventType:
 *           type: string
 *           enum: [Special, Regular]
 *           example: "Special"
 *         eventRoom:
 *           type: string
 *           example: "Main Auditorium"
 *         eventOrganizer:
 *           type: string
 *           example: "Tech Events Team"
 *         eventSpecialId:
 *           type: string
 *           example: "770e8400-e29b-41d4-a716-446655440002"
 *         willStartAt:
 *           type: string
 *           format: date-time
 *           example: "2024-06-15T09:00:00.000Z"
 *         willEndAt:
 *           type: string
 *           format: date-time
 *           example: "2024-06-15T17:00:00.000Z"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-10T12:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T14:30:00.000Z"
 *     UpcomingEventsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         totalRecords:
 *           type: number
 *           example: 45
 *         totalPages:
 *           type: number
 *           example: 3
 *         currentPage:
 *           type: number
 *           example: 1
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UpcomingEvent'
 */

/**
 * @swagger
 * /events/upcoming:
 *   get:
 *     summary: Retrieve upcoming events with pagination, sorting, and filtering
 *     tags: [Upcoming Events]
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
 *         example: 10
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
 *         example: "conference"
 *       - in: query
 *         name: searchField
 *         schema:
 *           type: string
 *           enum: [eventName, eventOrganizer, eventSpecialId]
 *         description: Field to search within
 *         example: "eventName"
 *     responses:
 *       200:
 *         description: Upcoming events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpcomingEventsResponse'
 *             examples:
 *               withFilters:
 *                 value:
 *                   success: true
 *                   totalRecords: 2
 *                   totalPages: 1
 *                   currentPage: 1
 *                   data:
 *                     - _id: "60d5f484f1a2c8b1f8e4e1b1"
 *                       eventName: "Summer Workshop Series"
 *                       eventDescription: "A series of professional development workshops"
 *                       eventType: "Regular"
 *                       eventRoom: "Training Room B"
 *                       eventOrganizer: "HR Department"
 *                       eventSpecialId: "880e8400-e29b-41d4-a716-446655440003"
 *                       willStartAt: "2024-07-01T09:00:00.000Z"
 *                       willEndAt: "2024-07-01T12:00:00.000Z"
 *                       createdAt: "2024-02-01T10:00:00.000Z"
 *                       updatedAt: "2024-02-01T10:00:00.000Z"
 *                     - _id: "60d5f484f1a2c8b1f8e4e1b2"
 *                       eventName: "Executive Leadership Summit"
 *                       eventDescription: "Annual gathering of industry leaders and executives"
 *                       eventType: "Special"
 *                       eventRoom: "Grand Ballroom"
 *                       eventOrganizer: "Corporate Events"
 *                       eventSpecialId: "990e8400-e29b-41d4-a716-446655440004"
 *                       willStartAt: "2024-08-15T08:00:00.000Z"
 *                       willEndAt: "2024-08-15T18:00:00.000Z"
 *                       createdAt: "2024-03-01T15:30:00.000Z"
 *                       updatedAt: "2024-03-05T09:15:00.000Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/', GetUpcomingEventsController.handle);

module.exports = Router;