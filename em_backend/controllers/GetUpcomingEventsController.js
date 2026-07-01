const EventService = require('../services/EventService');
const UpcomingEvent = require('../models/UpcomingEvent');

class GetUpcomingEventsController {
  static async handle(req, res) {
    try {
      const result = await EventService.getEvents(UpcomingEvent, req.query);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving upcoming events',
        error: error.message
      });
    }
  }
}

module.exports = GetUpcomingEventsController;