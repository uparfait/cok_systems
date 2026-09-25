const EventService = require('../services/EventService');
const { for_public } = require('../utilities/publicEvent');
const LiveEvent = require('../models/LiveEvent');

class GetLiveEventsController {
  static async handle(req, res) {
    try {
      const result = await EventService.getEvents(LiveEvent, req.query);
      // A Joint event reaches an anonymous caller as room and time only
      // (see utilities/publicEvent.js). A signed-in one sees it whole, so
      // the event manager's own screens are unchanged.
      return res.status(200).json({ ...result, data: for_public(result.data, req) });
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