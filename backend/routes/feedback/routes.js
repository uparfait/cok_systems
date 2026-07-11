/**
 * Feedback Routes
 * Handles phone verification, feedback submission, and feedback management
 */

const Router = require('express').Router();
const verifyPhoneController = require('../../controllers/feedback/verify_phone');
const submitFeedbackController = require('../../controllers/feedback/submit_feedback');
const searchByDepartmentController = require('../../controllers/feedback/search_by_department');
const searchAllController = require('../../controllers/feedback/search_all');
const getByIdController = require('../../controllers/feedback/get_by_id');
const deleteFeedbackController = require('../../controllers/feedback/delete_feedback');
const getByPhoneController = require('../../controllers/feedback/get_by_phone');
const submitUnservicedFeedbackController = require('../../controllers/feedback/submit_unserviced_feedback');

/**
 * @swagger
 * /feedback/verify-phone:
 *   post:
 *     summary: "Verify phone number and get assigned departments"
 *     description: "Verify if a phone number exists in the service delivery records and return the departments the visitor was assigned to for feedback submission."
 *     tags: [Feedback]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - telephone
 *             properties:
 *               telephone:
 *                 type: string
 *                 description: "Visitor's phone number"
 *                 example: "+250788123456"
 *     responses:
 *       200:
 *         description: Phone verified successfully
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
 *                   example: "Phone verified successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     visitor_name:
 *                       type: string
 *                       example: "Uwimana Jean Baptiste"
 *                     telephone:
 *                       type: string
 *                       example: "+250788123456"
 *                     assigned_departments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           department_id:
 *                             type: string
 *                             example: "DEPT-001"
 *                           department_name:
 *                             type: string
 *                             example: "Service d'Etat Civil"
 *                           reached_in:
 *                             type: boolean
 *                             example: true
 *       404:
 *         description: No service record found for this phone number
 *       500:
 *         description: Internal server error
 */
Router.post('/verify-phone', verifyPhoneController);

/**
 * @swagger
 * /feedback/by-phone/{telephone}:
 *   get:
 *     summary: "Get feedback by phone number"
 *     description: "Retrieve all feedback submitted by a specific phone number. Used for visitors to view their submitted feedback history."
 *     tags: [Feedback]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: telephone
 *         required: true
 *         schema:
 *           type: string
 *         description: "Phone number to search feedback for"
 *         example: "+250788123456"
 *     responses:
 *       200:
 *         description: Feedback retrieved successfully
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
 *                   example: "Feedback retrieved successfully"
 *                 total:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       department_name:
 *                         type: string
 *                       department_id:
 *                         type: string
 *                       provider_name:
 *                         type: string
 *                       rate:
 *                         type: integer
 *                         example: 8
 *                       rate_out_of:
 *                         type: integer
 *                         example: 10
 *                       textmessage:
 *                         type: string
 *                       created_date:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Phone number is required
 *       404:
 *         description: No feedback found
 *       500:
 *         description: Internal server error
 */
Router.get('/by-phone/:telephone', getByPhoneController);

/**
 * @swagger
 * /feedback/submit:
 *   post:
 *     summary: "Submit feedback for a department"
 *     description: "Submit a rating and optional comment for a department the visitor was assigned to. Rating is on a scale of 1-10."
 *     tags: [Feedback]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - telephone
 *               - department_id
 *               - rate
 *             properties:
 *               telephone:
 *                 type: string
 *                 description: "Visitor's phone number"
 *                 example: "+250788123456"
 *               department_id:
 *                 type: string
 *                 description: "Department ID from verified assignment"
 *                 example: "DEPT-001"
 *               rate:
 *                 type: integer
 *                 description: "Rating score (1-10)"
 *                 minimum: 1
 *                 maximum: 10
 *                 example: 8
 *               textmessage:
 *                 type: string
 *                 description: "Optional feedback message (max 500 chars)"
 *                 maxLength: 500
 *                 example: "The service was excellent and the staff was very helpful!"
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
 *       400:
 *         description: Validation error - missing or invalid fields
 *       403:
 *         description: Not assigned to this department
 *       404:
 *         description: No service record found
 *       500:
 *         description: Internal server error
 */
Router.post('/submit', submitFeedbackController);

/**
 * @swagger
 * /feedback/search-by-department:
 *   get:
 *     summary: "Search feedback by department"
 *     description: "Search feedback records by department ID with optional date range filtering."
 *     tags: [Feedback]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: department_id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Department ID to filter by"
 *         example: "DEPT-001"
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: "Start date (YYYY-MM-DD)"
 *         example: "2026-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: "End date (YYYY-MM-DD)"
 *         example: "2026-12-31"
 *     responses:
 *       200:
 *         description: Feedback search results
 *       400:
 *         description: Missing or invalid parameters
 *       500:
 *         description: Internal server error
 */
Router.get('/search-by-department', searchByDepartmentController);

/**
 * @swagger
 * /feedback/search:
 *   get:
 *     summary: "Search all feedback"
 *     description: "Retrieve paginated list of all feedback records with optional limit."
 *     tags: [Feedback]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: "Number of records per page"
 *         example: 50
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Page number"
 *         example: 1
 *     responses:
 *       200:
 *         description: Feedback list retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/search', searchAllController);

/**
 * @swagger
 * /feedback/{id}:
 *   get:
 *     summary: "Get feedback by ID"
 *     description: "Retrieve a single feedback record by its MongoDB ObjectId."
 *     tags: [Feedback]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Feedback MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Feedback details retrieved successfully
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Feedback not found
 *       500:
 *         description: Internal server error
 */
Router.get('/:id', getByIdController);

/**
 * @swagger
 * /feedback/{id}:
 *   delete:
 *     summary: "Delete feedback by ID"
 *     description: "Delete a feedback record by its MongoDB ObjectId."
 *     tags: [Feedback]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Feedback MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Feedback deleted successfully
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Feedback not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feedback/submit-unserviced:
 *   post:
 *     summary: "Submit unserviced feedback (no service/department required)"
 *     description: "Submit a rating and optional comment without requiring a service record or department assignment."
 *     tags: [Feedback]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rate
 *             properties:
 *               telephone:
 *                 type: string
 *                 description: "Optional phone number"
 *                 example: "+250788123456"
 *               user_name:
 *                 type: string
 *                 description: "Optional name"
 *                 example: "John Doe"
 *               rate:
 *                 type: integer
 *                 description: "Rating score (1-10)"
 *                 minimum: 1
 *                 maximum: 10
 *                 example: 8
 *               textmessage:
 *                 type: string
 *                 description: "Optional feedback message (max 500 chars)"
 *                 maxLength: 500
 *                 example: "The system is easy to use but could be faster."
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
 *       400:
 *         description: Validation error - missing or invalid fields
 *       500:
 *         description: Internal server error
 */
Router.post('/submit-unserviced', submitUnservicedFeedbackController);

Router.delete('/:id', deleteFeedbackController);

module.exports = Router;