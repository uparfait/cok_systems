const withTransaction = require('../utilities/withTransaction');
const RecurringEvent = require('../models/RecurringEvent');
const EventValidator = require('../validators/EventValidator');
const RecurringValidator = require('../validators/RecurringValidator');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');

class UpdateRecurringEventController {
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

        // Validate recurring data if provided
        if (sanitizedData.eventRecurring) {
          const recurringValidation = RecurringValidator.validate({
            eventRecurring: sanitizedData.eventRecurring
          });
          if (!recurringValidation.isValid) {
            throw new Error(recurringValidation.errors.join(', '));
          }
        }

        // Find existing event
        const existingEvent = await RecurringEvent.findById(id).session(session);
        if (!existingEvent) {
          throw new Error('Recurring event not found');
        }

      // Check room availability if room changed (virtual events hold no room)
      if (sanitizedData.eventRoom && sanitizedData.eventRoom !== 'virtual' && sanitizedData.eventRoom !== existingEvent.eventRoom) {
        const availability = await CheckRoomAvailability.execute(
          sanitizedData.eventRoom,
          sanitizedData.eventStartDate || existingEvent.eventStartDate,
          sanitizedData.eventEndDate || existingEvent.eventEndDate,
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
        message: 'Recurring event updated successfully',
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

module.exports = UpdateRecurringEventController;