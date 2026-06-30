const EventService = require('../services/EventService');
const PastEvent = require('../models/PastEvent');

class GetPastEventsController {
  static async handle(req, res) {
    try {
      const result = await EventService.getEvents(PastEvent, req.query);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving past events',
        error: error.message
      });
    }
  }
}

module.exports = GetPastEventsController;