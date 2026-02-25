/**
 * Feedback Routes
 * Handles phone verification and feedback submission
 */

const Router = require('express').Router();
const verifyPhoneController = require('../../controllers/feedback/verify_phone');
const submitFeedbackController = require('../../controllers/feedback/submit_feedback');

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

module.exports = Router;
