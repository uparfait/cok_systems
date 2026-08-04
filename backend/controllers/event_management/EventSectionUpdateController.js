const EventSectionUpdateService = require('../../services/EventSectionUpdateService');

class EventSectionUpdateController {
  static async handle(req, res) {
    try {
      const { eventId, eventType, section, data } = req.body;

      if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });
      if (!eventType) return res.status(400).json({ success: false, message: 'eventType is required' });
      if (!section) return res.status(400).json({ success: false, message: 'section is required (basic, organizer, agenda, room)' });
      if (!data || Object.keys(data).length === 0) return res.status(400).json({ success: false, message: 'data is required' });

      const validSections = ['basic', 'organizer', 'agenda', 'room'];
      if (!validSections.includes(section)) {
        return res.status(400).json({ success: false, message: 'section must be basic, organizer, agenda, or room' });
      }

      const result = await EventSectionUpdateService.execute(eventId, eventType, section, data);

      return res.status(200).json({
        success: true,
        message: `${section} section updated successfully`,
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

module.exports = EventSectionUpdateController;
