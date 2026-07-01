const CancelEventService = require('../services/CancelEventService');

class CancelEventController {
  static async handle(req, res) {
    try {
      const { eventId, eventType, reason } = req.body;

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

      const result = await CancelEventService.execute(eventId, eventType, reason || '');

      return res.status(200).json({
        success: true,
        message: 'Event cancelled successfully.',
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

module.exports = CancelEventController;