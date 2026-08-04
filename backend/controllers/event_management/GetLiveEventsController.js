const EventService = require('../../services/EventService');
const LiveEvent = require('../../models/LiveEvent');

class GetLiveEventsController {
  static async handle(req, res) {
    try {
      const result = await EventService.getEvents(LiveEvent, req.query);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving live events',
        error: error.message
      });
    }
  }
}

module.exports = GetLiveEventsController;

