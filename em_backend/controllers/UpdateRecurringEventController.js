const withTransaction = require('../utilities/withTransaction');
const RecurringEvent = require('../models/RecurringEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const EventValidator = require('../validators/EventValidator');
const RecurringValidator = require('../validators/RecurringValidator');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');
const { firstRecurringOccurrence } = require('../utilities/eventCalendar');
const { notifyInviteesOfScheduleChange, notifyInviteesOfDetailsChange } = require('../utilities/notifyInviteesOfUpdate');

class UpdateRecurringEventController {
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

        const roomChanged = !!(sanitizedData.eventRoom && sanitizedData.eventRoom !== existingEvent.eventRoom);
        const timeChanged = !!sanitizedData.eventRecurring;
        const effectiveRoom = sanitizedData.eventRoom || existingEvent.eventRoom;
        const isVirtual = (sanitizedData.eventFormat || existingEvent.eventFormat) === 'Virtual' || effectiveRoom === 'virtual';

        // Any room or schedule change is checked across the WHOLE series with
        // the effective configuration. The series itself AND all of its
        // generated occurrence instances are excluded, so the event never
        // conflicts with its own children.
        if ((roomChanged || timeChanged) && !isVirtual) {
          const effectiveConfig = sanitizedData.eventRecurring || existingEvent.eventRecurring;
          const availability = await CheckRoomAvailability.executeRecurring(
            effectiveRoom,
            effectiveConfig,
            existingEvent.eventSpecialId
          );

          if (!availability.available) {
            throw new Error('Selected room is already reserved during the requested time');
          }
        }

        // Update event
        Object.assign(existingEvent, sanitizedData);
        await existingEvent.save({ session, validateModifiedOnly: true });

        const escaped = existingEvent.eventSpecialId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (timeChanged) {
          // The series schedule changed: generated occurrence instances carry
          // the old times, so delete them and let the monitor regenerate them.
          await UpcomingEvent.deleteMany(
            { eventSpecialId: { $regex: `^${escaped}_` } },
            { session }
          );
        } else {
          // A series-level edit must also reach the already-generated occurrence
          // instances, otherwise they keep showing the old details.
          await UpcomingEvent.updateMany(
            { eventSpecialId: { $regex: `^${escaped}_` } },
            {
              $set: {
                eventName: existingEvent.eventName,
                eventDescription: existingEvent.eventDescription,
                eventType: existingEvent.eventType,
                expectedAudience: existingEvent.expectedAudience,
                eventOrganizer: existingEvent.eventOrganizer,
                activityAgenda: existingEvent.activityAgenda || [],
                eventRoom: existingEvent.eventRoom,
                eventFormat: existingEvent.eventFormat || 'Physical',
                virtualLink: existingEvent.virtualLink || '',
                virtualDescription: existingEvent.virtualDescription || '',
              },
            },
            { session }
          );
        }

        return { existingEvent, timeChanged };
      });

      // Announce the change to everyone invited. A schedule change sends an
      // updated calendar invitation with the recurrence rule; any other change
      // sends a plain email only, leaving calendars as they are.
      try {
        const occ = firstRecurringOccurrence(existingEvent.eventRecurring);
        const eventForEmail = {
          eventName: existingEvent.eventName,
          eventDescription: existingEvent.eventDescription || '',
          eventRoom: existingEvent.eventRoom,
          eventFormat: existingEvent.eventFormat || 'Physical',
          virtualLink: existingEvent.virtualLink || '',
          virtualDescription: existingEvent.virtualDescription || '',
          eventOrganizer: existingEvent.eventOrganizer,
          start: occ.start,
          end: occ.end,
          isRecurring: true,
          recurring: existingEvent.eventRecurring,
        };
        const notifyPromise = timeChanged
          ? notifyInviteesOfScheduleChange(existingEvent.eventSpecialId, eventForEmail)
          : notifyInviteesOfDetailsChange(existingEvent.eventSpecialId, eventForEmail);
        notifyPromise.catch((err) => console.error('Failed to notify invitees of recurring event update:', err.message));
      } catch (notifyError) {
        console.error('Failed to build recurring update notification:', notifyError.message);
      }

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