const EventService = require('../../services/EventService');
const RecurringEvent = require('../../models/RecurringEvent');

class GetRecurringEventsController {
  static async handle(req, res) {
    try {
      const result = await EventService.getEvents(RecurringEvent, req.query);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving recurring events',
        error: error.message
      });
    }
  }
}

module.exports = GetRecurringEventsController;

