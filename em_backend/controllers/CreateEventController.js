const EventService = require('../services/EventService');

class CreateEventController {
  static async handle(req, res) {
    try {
      const eventData = req.body;
      const result = await EventService.createEvent(eventData);
      
      return res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: result.data
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = CreateEventController;