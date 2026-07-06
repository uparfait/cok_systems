const PostponeEventService = require('../services/PostponeEventService');

class PostponeEventController {
  static async handle(req, res) {
    try {
      const { eventId, eventType, newSchedule } = req.body;

      if (!eventId) {
        return res.status(400).json({
          success: false,
          message: 'eventId is required.',
        });
      }

      if (!eventType) {
        return res.status(400).json({
          success: false,
          message: 'eventType is required (live, upcoming, or recurring).',
        });
      }

      const validTypes = ['live', 'upcoming', 'recurring'];
      if (!validTypes.includes(eventType)) {
        return res.status(400).json({
          success: false,
          message: 'eventType must be live, upcoming, or recurring.',
        });
      }

      if (!newSchedule || Object.keys(newSchedule).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'newSchedule with at least one date/time field is required.',
        });
      }

      const result = await PostponeEventService.execute(eventId, eventType, newSchedule);

      return res.status(200).json({
        success: true,
        message: 'Event postponed successfully.',
        data: result.data,
      });
    } catch (error) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = PostponeEventController;