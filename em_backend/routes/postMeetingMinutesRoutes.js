// routes/PostMeetingMinutesRoutes.js
const Router = require('express').Router();
const PostMeetingMinutesController = require('../controllers/PostMeetingMinutesController');
const MinutesFilesController = require('../controllers/MinutesFilesController');
const rbac = require('../middlewares/rbac');

// Minutes are written by organizers on the public event pages (no bearer);
// a signed-in caller must be an event manager.
const writeMinutesIfSignedIn = rbac.requireLinksIfSignedIn('events');

/**
 * @swagger
 * components:
 *   schemas:
 *     PostMeetingMinutes:
 *       type: object
 *       properties:
 *         meetingMinutes:
 *           type: string
 *           description: The meeting minutes content
 *         documentedBy:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             role:
 *               type: string
 *             institution:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *         meetingDate:
 *           type: string
 *           format: date-time
 *         eventSpecialId:
 *           type: string
 */

/**
 * @swagger
 * /events/{eventSpecialId}/minutes:
 *   post:
 *     summary: Save or update meeting minutes for an event
 *     tags: [Meeting Minutes]
 *     parameters:
 *       - in: path
 *         name: eventSpecialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event special ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - meetingMinutes
 *             properties:
 *               meetingMinutes:
 *                 type: string
 *                 description: The meeting minutes content
 *     responses:
 *       200:
 *         description: Minutes saved successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get meeting minutes for an event
 *     tags: [Meeting Minutes]
 *     parameters:
 *       - in: path
 *         name: eventSpecialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event special ID
 *     responses:
 *       200:
 *         description: Minutes retrieved successfully
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 * /events/{eventSpecialId}/minutes/series:
 *   get:
 *     summary: Get all minutes for a recurring event series
 *     tags: [Meeting Minutes]
 *     parameters:
 *       - in: path
 *         name: eventSpecialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Recurring event parent special ID
 *     responses:
 *       200:
 *         description: Series minutes retrieved successfully
 *       404:
 *         description: Recurring event not found
 *       500:
 *         description: Server error
 */
Router.post('/:eventSpecialId/minutes/files', writeMinutesIfSignedIn, MinutesFilesController.uploadMiddleware, MinutesFilesController.uploadFiles);
Router.put('/:eventSpecialId/minutes/files/:fileId', writeMinutesIfSignedIn, MinutesFilesController.updateMiddleware, MinutesFilesController.updateFile);
Router.delete('/:eventSpecialId/minutes/files/:fileId', writeMinutesIfSignedIn, MinutesFilesController.deleteFile);
Router.post('/:eventSpecialId/minutes', writeMinutesIfSignedIn, PostMeetingMinutesController.saveMinutes);
Router.get('/:eventSpecialId/minutes', PostMeetingMinutesController.getMinutes);
Router.get('/:eventSpecialId/minutes/series', PostMeetingMinutesController.getSeriesMinutes);
Router.post('/:eventSpecialId/minutes/designate', writeMinutesIfSignedIn, PostMeetingMinutesController.designateMinutes);

module.exports = Router;