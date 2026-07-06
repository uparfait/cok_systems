const Router = require('express').Router();
const CancelEventController = require('../controllers/CancelEventController');
const PostponeEventController = require('../controllers/PostponeEventController');

/**
 * @swagger
 * /events/cancel:
 *   put:
 *     summary: Cancel an event (live, upcoming, or recurring)
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - eventType
 *             properties:
 *               eventId:
 *                 type: string
 *                 description: MongoDB ID of the event
 *                 example: "60d5f484f1a2c8b1f8e4e1a1"
 *               eventType:
 *                 type: string
 *                 enum: [live, upcoming, recurring]
 *                 description: Type of the event
 *                 example: "upcoming"
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *                 example: "Venue maintenance issue"
 *     responses:
 *       200:
 *         description: Event cancelled successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Event not found
 */
Router.put('/cancel', CancelEventController.handle);

/**
 * @swagger
 * /events/postpone:
 *   put:
 *     summary: Postpone an event (live, upcoming, or recurring)
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - eventType
 *               - newSchedule
 *             properties:
 *               eventId:
 *                 type: string
 *                 description: MongoDB ID of the event
 *                 example: "60d5f484f1a2c8b1f8e4e1a1"
 *               eventType:
 *                 type: string
 *                 enum: [live, upcoming, recurring]
 *                 description: Type of the event
 *                 example: "upcoming"
 *               newSchedule:
 *                 type: object
 *                 description: New schedule fields (depends on eventType)
 *                 example:
 *                   willStartAt: "2024-07-01T10:00:00.000Z"
 *                   willEndAt: "2024-07-01T16:00:00.000Z"
 *     responses:
 *       200:
 *         description: Event postponed successfully
 *       400:
 *         description: Validation error or room conflict
 *       404:
 *         description: Event not found
 */
Router.put('/postpone', PostponeEventController.handle);

module.exports = Router;