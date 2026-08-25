const withTransaction = require('../utilities/withTransaction');
const LiveEvent = require('../models/LiveEvent');
const EventValidator = require('../validators/EventValidator');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');
const { fromUTCInstant } = require('../utilities/eventCalendar');
const { notifyInviteesOfScheduleChange, notifyInviteesOfDetailsChange } = require('../utilities/notifyInviteesOfUpdate');

class UpdateLiveEventController {
  static async handle(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const { existingEvent, timeChanged } = await withTransaction(async (session) => {
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

        const effectiveStart = sanitizedData.startedAt || existingEvent.startedAt;
        const effectiveEnd = sanitizedData.willEndAt || existingEvent.willEndAt;
        const timeChanged =
          new Date(effectiveStart).getTime() !== new Date(existingEvent.startedAt).getTime() ||
          new Date(effectiveEnd).getTime() !== new Date(existingEvent.willEndAt).getTime();
        const roomChanged = !!(sanitizedData.eventRoom && sanitizedData.eventRoom !== existingEvent.eventRoom);
        const effectiveRoom = sanitizedData.eventRoom || existingEvent.eventRoom;
        const isVirtual = (sanitizedData.eventFormat || existingEvent.eventFormat) === 'Virtual' || effectiveRoom === 'virtual';

        // Any room or time change is checked for conflicts in the effective
        // room, always excluding this event itself (virtual events hold no room)
        if ((roomChanged || timeChanged) && !isVirtual) {
          const availability = await CheckRoomAvailability.execute(
            effectiveRoom,
            effectiveStart,
            effectiveEnd,
            existingEvent.eventSpecialId  // exclude self by eventSpecialId string
          );

          if (!availability.available) {
            throw new Error('Selected room is already reserved during the requested time');
          }
        }

        // Update event
        Object.assign(existingEvent, sanitizedData);
        await existingEvent.save({ session, validateModifiedOnly: true });

        return { existingEvent, timeChanged };
      });

      // Announce the change to everyone invited. A time change sends an updated
      // calendar invitation; any other change sends a plain email only.
      const eventForEmail = {
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
      };
      const notifyPromise = timeChanged
        ? notifyInviteesOfScheduleChange(existingEvent.eventSpecialId, eventForEmail)
        : notifyInviteesOfDetailsChange(existingEvent.eventSpecialId, eventForEmail);
      notifyPromise.catch((err) => console.error('Failed to notify invitees of live event update:', err.message));

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