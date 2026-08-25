const withTransaction = require('../utilities/withTransaction');
const UpcomingEvent = require('../models/UpcomingEvent');
const EventValidator = require('../validators/EventValidator');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');

class UpdateUpcomingEventController {
  static async handle(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingEvent = await withTransaction(async (session) => {
        // Validate input
        const validation = EventValidator.validateEventData(updateData);
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '));
        }

        const sanitizedData = EventValidator.sanitizeEventData(updateData);

        // Find existing event
        const existingEvent = await UpcomingEvent.findById(id).session(session);
        if (!existingEvent) {
          throw new Error('Upcoming event not found');
        }

        // Validate willStartAt is in the future
        if (sanitizedData.willStartAt && new Date(sanitizedData.willStartAt) <= new Date()) {
          throw new Error('Start time must be in the future');
        }

        // Validate willEndAt > willStartAt
        const startTime = sanitizedData.willStartAt || existingEvent.willStartAt;
        const endTime = sanitizedData.willEndAt || existingEvent.willEndAt;
        if (new Date(endTime) <= new Date(startTime)) {
          throw new Error('End time must be after start time');
        }

        // Check room availability if room changed (virtual events hold no room)
        if (sanitizedData.eventRoom && sanitizedData.eventRoom !== 'virtual' && sanitizedData.eventRoom !== existingEvent.eventRoom) {
          const availability = await CheckRoomAvailability.execute(
            sanitizedData.eventRoom,
            startTime,
            endTime,
            existingEvent.eventSpecialId  // exclude self by eventSpecialId string
          );

          if (!availability.available) {
            throw new Error('Selected room is already reserved during the requested time');
          }
        }

        // Update event
        Object.assign(existingEvent, sanitizedData);
        await existingEvent.save({ session, validateModifiedOnly: true });

        return existingEvent;
      });

      return res.status(200).json({
        success: true,
        message: 'Upcoming event updated successfully',
        data: existingEvent
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = UpdateUpcomingEventController;