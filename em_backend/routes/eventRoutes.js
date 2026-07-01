const Router = require('express').Router();
const CreateEventController = require('../controllers/CreateEventController');
const UpdateLiveEventController = require('../controllers/UpdateLiveEventController');
const UpdateUpcomingEventController = require('../controllers/UpdateUpcomingEventController');
const UpdateRecurringEventController = require('../controllers/UpdateRecurringEventController');
const ChangeEventRoomController = require('../controllers/ChangeEventRoomController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Event:
 *       type: object
 *       required:
 *         - eventName
 *         - eventDescription
 *         - eventType
 *         - eventRoom
 *         - eventOrganizer
 *         - eventMode
 *       properties:
 *         eventName:
 *           type: string
 *           maxlength: 500
 *           description: Name of the event
 *           example: "Annual Tech Conference 2024"
 *         eventDescription:
 *           type: string
 *           maxlength: 2000
 *           description: Detailed description of the event
 *           example: "A comprehensive technology conference featuring keynote speakers"
 *         eventType:
 *           type: string
 *           enum: [Special, Regular]
 *           description: Type of event
 *           example: "Special"
 *         eventRoom:
 *           type: string
 *           description: Room name where event will be held
 *           example: "Conference Room A"
 *         eventOrganizer:
 *           type: string
 *           description: Name of the event organizer
 *           example: "John Doe"
 *         eventSpecialId:
 *           type: string
 *           description: Auto-generated unique identifier
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     CreateEventRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/Event'
 *         - type: object
 *           properties:
 *             eventMode:
 *               type: string
 *               enum: [live, upcoming, recurring]
 *               description: Mode of event creation
 *               example: "live"
 *             startedAt:
 *               type: string
 *               format: date-time
 *               description: Start time for live events
 *               example: "2024-02-15T09:00:00.000Z"
 *             willEndAt:
 *               type: string
 *               format: date-time
 *               description: End time for live events
 *               example: "2024-02-15T17:00:00.000Z"
 *             willStartAt:
 *               type: string
 *               format: date-time
 *               description: Start time for upcoming events (must be in future)
 *               example: "2024-06-01T10:00:00.000Z"
 *             eventStartDate:
 *               type: string
 *               format: date-time
 *               description: Start date for recurring events
 *               example: "2024-02-01T00:00:00.000Z"
 *             eventEndDate:
 *               type: string
 *               format: date-time
 *               description: End date for recurring events
 *               example: "2024-12-31T23:59:59.000Z"
 *             eventRecurring:
 *               type: object
 *               description: Recurring event configuration
 *               properties:
 *                 isRecurring:
 *                   type: boolean
 *                   example: true
 *                 recurringType:
 *                   type: string
 *                   enum: [Daily, Weekly, Monthly]
 *                   example: "Weekly"
 *                 recurringEndDate:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-12-31T23:59:59.000Z"
 *                 weeklyDays:
 *                   type: array
 *                   items:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 6
 *                   example: [1, 3, 5]
 *                   description: Days of week (0=Sunday, 6=Saturday)
 *                 monthlyDates:
 *                   type: array
 *                   items:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 31
 *                   example: [1, 15]
 *                 monthlyPattern:
 *                   type: string
 *                   enum: [specific, firstDay, lastDay, firstTwoWeeks, lastTwoWeeks, mixed]
 *                   example: "specific"
 *                 dailyStartTime:
 *                   type: string
 *                   pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *                   example: "09:00"
 *                 dailyEndTime:
 *                   type: string
 *                   pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *                   example: "17:00"
 *                 willExpire:
 *                   type: boolean
 *                   example: false
 *                 willExpireAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-12-31T23:59:59.000Z"
 *     ChangeRoomRequest:
 *       type: object
 *       required:
 *         - eventId
 *         - eventType
 *         - newRoom
 *       properties:
 *         eventId:
 *           type: string
 *           description: MongoDB ID of the event
 *           example: "60d5f484f1a2c8b1f8e4e1a1"
 *         eventType:
 *           type: string
 *           enum: [live, upcoming, recurring]
 *           description: Type of the event
 *           example: "live"
 *         newRoom:
 *           type: string
 *           description: New room name
 *           example: "Conference Room B"
 */

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a new event (live, upcoming, or recurring)
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 description: Live event creation
 *                 required:
 *                   - eventName
 *                   - eventDescription
 *                   - eventType
 *                   - eventRoom
 *                   - eventOrganizer
 *                   - eventMode
 *                   - startedAt
 *                   - willEndAt
 *                 properties:
 *                   eventMode:
 *                     type: string
 *                     enum: [live]
 *                     example: "live"
 *                   eventName:
 *                     type: string
 *                     example: "Team Standup Meeting"
 *                   eventDescription:
 *                     type: string
 *                     example: "Daily team standup to discuss progress"
 *                   eventType:
 *                     type: string
 *                     enum: [Regular]
 *                     example: "Regular"
 *                   eventRoom:
 *                     type: string
 *                     example: "Conference Room A"
 *                   eventOrganizer:
 *                     type: string
 *                     example: "Sarah Johnson"
 *                   startedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-02-15T09:00:00.000Z"
 *                   willEndAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-02-15T10:00:00.000Z"
 *               - type: object
 *                 description: Upcoming event creation
 *                 required:
 *                   - eventName
 *                   - eventDescription
 *                   - eventType
 *                   - eventRoom
 *                   - eventOrganizer
 *                   - eventMode
 *                   - willStartAt
 *                   - willEndAt
 *                 properties:
 *                   eventMode:
 *                     type: string
 *                     enum: [upcoming]
 *                     example: "upcoming"
 *                   eventName:
 *                     type: string
 *                     example: "Product Launch Event"
 *                   eventDescription:
 *                     type: string
 *                     example: "Launch of our new product line"
 *                   eventType:
 *                     type: string
 *                     enum: [Special]
 *                     example: "Special"
 *                   eventRoom:
 *                     type: string
 *                     example: "Main Auditorium"
 *                   eventOrganizer:
 *                     type: string
 *                     example: "Marketing Team"
 *                   willStartAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-06-15T10:00:00.000Z"
 *                   willEndAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-06-15T16:00:00.000Z"
 *               - type: object
 *                 description: Recurring event creation
 *                 required:
 *                   - eventName
 *                   - eventDescription
 *                   - eventType
 *                   - eventRoom
 *                   - eventOrganizer
 *                   - eventMode
 *                   - eventStartDate
 *                   - eventEndDate
 *                   - eventRecurring
 *                 properties:
 *                   eventMode:
 *                     type: string
 *                     enum: [recurring]
 *                     example: "recurring"
 *                   eventName:
 *                     type: string
 *                     example: "Weekly Team Training"
 *                   eventDescription:
 *                     type: string
 *                     example: "Weekly training session for all team members"
 *                   eventType:
 *                     type: string
 *                     enum: [Regular]
 *                     example: "Regular"
 *                   eventRoom:
 *                     type: string
 *                     example: "Training Room B"
 *                   eventOrganizer:
 *                     type: string
 *                     example: "HR Department"
 *                   eventStartDate:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-02-01T00:00:00.000Z"
 *                   eventEndDate:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-12-31T23:59:59.000Z"
 *                   eventRecurring:
 *                     type: object
 *                     required:
 *                       - isRecurring
 *                       - recurringType
 *                       - recurringEndDate
 *                     properties:
 *                       isRecurring:
 *                         type: boolean
 *                         example: true
 *                       recurringType:
 *                         type: string
 *                         enum: [Weekly]
 *                         example: "Weekly"
 *                       recurringEndDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-12-31T23:59:59.000Z"
 *                       weeklyDays:
 *                         type: array
 *                         items:
 *                           type: number
 *                         example: [2, 4]
 *                       willExpire:
 *                         type: boolean
 *                         example: false
 *     responses:
 *       201:
 *         description: Event created successfully
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
 *                   example: "Event created successfully"
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/LiveEvent'
 *                     - $ref: '#/components/schemas/UpcomingEvent'
 *                     - $ref: '#/components/schemas/RecurringEvent'
 *       400:
 *         description: Validation error or room conflict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Selected room is already reserved during the requested time"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.post('/', CreateEventController.handle);

/**
 * @swagger
 * /events/live/{id}:
 *   put:
 *     summary: Update a live event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: MongoDB ID of the live event to update
 *         example: "60d5f484f1a2c8b1f8e4e1a1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *                 maxlength: 500
 *                 example: "Updated Team Meeting"
 *               eventDescription:
 *                 type: string
 *                 maxlength: 2000
 *                 example: "Updated meeting description"
 *               eventType:
 *                 type: string
 *                 enum: [Special, Regular]
 *                 example: "Regular"
 *               eventRoom:
 *                 type: string
 *                 example: "Conference Room B"
 *               eventOrganizer:
 *                 type: string
 *                 example: "Jane Smith"
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-02-15T10:00:00.000Z"
 *               willEndAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-02-15T11:00:00.000Z"
 *     responses:
 *       200:
 *         description: Live event updated successfully
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
 *                   example: "Live event updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/LiveEvent'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Live event not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Live event not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.put('/live/:id', UpdateLiveEventController.handle);

/**
 * @swagger
 * /events/upcoming/{id}:
 *   put:
 *     summary: Update an upcoming event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: MongoDB ID of the upcoming event to update
 *         example: "60d5f484f1a2c8b1f8e4e1a2"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *                 maxlength: 500
 *                 example: "Updated Product Launch"
 *               eventDescription:
 *                 type: string
 *                 maxlength: 2000
 *                 example: "Updated launch event details"
 *               eventType:
 *                 type: string
 *                 enum: [Special, Regular]
 *                 example: "Special"
 *               eventRoom:
 *                 type: string
 *                 example: "Grand Hall"
 *               eventOrganizer:
 *                 type: string
 *                 example: "Marketing Department"
 *               willStartAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-07-01T10:00:00.000Z"
 *               willEndAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-07-01T16:00:00.000Z"
 *     responses:
 *       200:
 *         description: Upcoming event updated successfully
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
 *                   example: "Upcoming event updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/UpcomingEvent'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Start time must be in the future"
 *       404:
 *         description: Upcoming event not found
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
Router.put('/upcoming/:id', UpdateUpcomingEventController.handle);

/**
 * @swagger
 * /events/recurring/{id}:
 *   put:
 *     summary: Update a recurring event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: MongoDB ID of the recurring event to update
 *         example: "60d5f484f1a2c8b1f8e4e1a3"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *                 maxlength: 500
 *                 example: "Updated Weekly Training"
 *               eventDescription:
 *                 type: string
 *                 maxlength: 2000
 *                 example: "Updated training program description"
 *               eventType:
 *                 type: string
 *                 enum: [Special, Regular]
 *                 example: "Regular"
 *               eventRoom:
 *                 type: string
 *                 example: "Training Room C"
 *               eventOrganizer:
 *                 type: string
 *                 example: "L&D Department"
 *               eventStartDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-03-01T00:00:00.000Z"
 *               eventEndDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-12-31T23:59:59.000Z"
 *               eventRecurring:
 *                 type: object
 *                 properties:
 *                   recurringType:
 *                     type: string
 *                     enum: [Weekly]
 *                     example: "Weekly"
 *                   weeklyDays:
 *                     type: array
 *                     items:
 *                       type: number
 *                     example: [1, 3, 5]
 *                   recurringEndDate:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-12-31T23:59:59.000Z"
 *                   willExpire:
 *                     type: boolean
 *                     example: true
 *                   willExpireAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-12-31T23:59:59.000Z"
 *     responses:
 *       200:
 *         description: Recurring event updated successfully
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
 *                   example: "Recurring event updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/RecurringEvent'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Weekly recurring requires at least one day"
 *       404:
 *         description: Recurring event not found
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
Router.put('/recurring/:id', UpdateRecurringEventController.handle);

/**
 * @swagger
 * /events/change-room:
 *   put:
 *     summary: Change room for any event type
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangeRoomRequest'
 *     responses:
 *       200:
 *         description: Room changed successfully
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
 *                   example: "Event room changed successfully"
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/LiveEvent'
 *                     - $ref: '#/components/schemas/UpcomingEvent'
 *                     - $ref: '#/components/schemas/RecurringEvent'
 *       400:
 *         description: Room conflict or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "New room is already reserved during the event time"
 *       404:
 *         description: Event or room not found
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
Router.put('/change-room', ChangeEventRoomController.handle);

module.exports = Router;