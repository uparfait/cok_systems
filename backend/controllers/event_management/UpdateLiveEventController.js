const mongoose = require('mongoose');
const LiveEvent = require('../../models/LiveEvent');
const EventValidator = require('../validators/EventValidator');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');

class UpdateLiveEventController {
  static async handle(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate input
      const validation = EventValidator.validateEventData(updateData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const sanitizedData = EventValidator.sanitizeEventData(updateData);

      // Find existing event
      const existingEvent = await LiveEvent.findById(id).session(session);
      if (!existingEvent) {
        throw new Error('Live event not found');
      }

      // Check room availability if room changed
      if (sanitizedData.eventRoom && sanitizedData.eventRoom !== existingEvent.eventRoom) {
        const availability = await CheckRoomAvailability.execute(
          sanitizedData.eventRoom,
          sanitizedData.startedAt || existingEvent.startedAt,
          sanitizedData.willEndAt || existingEvent.willEndAt,
          existingEvent.eventSpecialId  // exclude self by eventSpecialId string
        );

        if (!availability.available) {
          throw new Error('Selected room is already reserved during the requested time');
        }
      }

      // Update event
      Object.assign(existingEvent, sanitizedData);
      await existingEvent.save({ session, validateModifiedOnly: true });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: 'Live event updated successfully',
        data: existingEvent
      });
    } catch (error) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: error.message
      });
    } finally {
      session.endSession();
    }
  }
}

module.exports = UpdateLiveEventController;
