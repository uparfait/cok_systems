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

/**
 * POST /feedback/verify-phone
 * Verify phone number and get assigned departments
 */
Router.post('/verify-phone', verifyPhoneController);

/**
 * POST /feedback/submit
 * Submit feedback for a specific department
 */
Router.post('/submit', submitFeedbackController);

/**
 * GET /feedback/search-by-department
 * Search feedback by department with optional date range
 * Query params: department_id (required), from (optional), to (optional)
 */
Router.get('/search-by-department', searchByDepartmentController);

/**
 * GET /feedback/search
 * Search all feedback with optional limit
 * Query params: limit (optional, default 50), page (optional, default 1)
 */
Router.get('/search', searchAllController);

/**
 * GET /feedback/:id
 * Get feedback by MongoDB _id
 * NOTE: This must come AFTER /search and /search-by-department
 */
Router.get('/:id', getByIdController);

/**
 * DELETE /feedback/:id
 * Delete feedback by MongoDB _id
 */
Router.delete('/:id', deleteFeedbackController);

module.exports = Router;
