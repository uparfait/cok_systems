const withTransaction = require('../utilities/withTransaction');
const LiveEvent = require('../models/LiveEvent');
const EventValidator = require('../validators/EventValidator');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');
const { fromUTCInstant } = require('../utilities/eventCalendar');
const { notifyInviteesOfScheduleChange } = require('../utilities/notifyInviteesOfUpdate');

class UpdateLiveEventController {
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
        const existingEvent = await LiveEvent.findById(id).session(session);
        if (!existingEvent) {
          throw new Error('Live event not found');
        }

        // Check room availability if room changed (virtual events hold no room)
        if (sanitizedData.eventRoom && sanitizedData.eventRoom !== 'virtual' && sanitizedData.eventRoom !== existingEvent.eventRoom) {
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

        return existingEvent;
      });

      // Push the change to everyone invited (same UID, bumped SEQUENCE) so
      // their calendars always carry the latest details. Never blocks the response.
      notifyInviteesOfScheduleChange(existingEvent.eventSpecialId, {
        eventName: existingEvent.eventName,
        eventDescription: existingEvent.eventDescription || '',
        eventRoom: existingEvent.eventRoom,
        eventFormat: existingEvent.eventFormat || 'Physical',
        virtualLink: existingEvent.virtualLink || '',
        virtualDescription: existingEvent.virtualDescription || '',
        eventOrganizer: existingEvent.eventOrganizer,
        start: fromUTCInstant(existingEvent.startedAt),
        end: fromUTCInstant(existingEvent.willEndAt),
        isRecurring: false,
        recurring: null,
      }).catch((err) => console.error('Failed to notify invitees of live event update:', err.message));

      return res.status(200).json({
        success: true,
        message: 'Live event updated successfully',
        data: existingEvent
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Something went wrong while updating the live event. Please try again.",
        error: error.something
      });
    }
  }
}

module.exports = UpdateLiveEventController;