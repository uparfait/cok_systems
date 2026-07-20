const EventAccessController = require('../controllers/EventAccessController');

const requireEventAccess = EventAccessController.validateToken;

module.exports = requireEventAccess;
