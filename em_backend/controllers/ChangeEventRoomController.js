const withTransaction = require('../utilities/withTransaction');
const Room = require('../models/Room');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');
const UpcomingEvent = require('../models/UpcomingEvent');
const { fromUTCInstant, firstRecurringOccurrence } = require('../utilities/eventCalendar');
const { notifyInviteesOfDetailsChange } = require('../utilities/notifyInviteesOfUpdate');

class ChangeEventRoomController {
  static async handle(req, res) {
    try {
      const { eventId, eventType, newRoom } = req.body;

      const event = await withTransaction(async (session) => {
        // Verify new room exists
        const room = await Room.findOne({
          roomName: newRoom.toLowerCase(),
          isActive: true
        }).session(session);

        if (!room) {
          throw new Error('New room not found or is inactive');
        }

        let Model;
        switch (eventType) {
          case 'live':
            Model = require('../models/LiveEvent');
            break;
          case 'upcoming':
            Model = require('../models/UpcomingEvent');
            break;
          case 'recurring':
            Model = require('../models/RecurringEvent');
            break;
          default:
            throw new Error('Invalid event type');
        }

        const event = await Model.findById(eventId).session(session);
        if (!event) {
          throw new Error('Event not found');
        }

        if (eventType === 'recurring') {
          // Check the WHOLE series against the new room. The series itself and
          // all of its generated occurrence instances are excluded so the
          // event never conflicts with its own children.
          const availability = await CheckRoomAvailability.executeRecurring(
            newRoom,
            event.eventRecurring,
            event.eventSpecialId
          );
          if (!availability.available) {
            throw new Error('New room is already reserved during the event time');
          }
        } else {
          const startTime = eventType === 'live' ? event.startedAt : event.willStartAt;
          const endTime = event.willEndAt;

          // Check availability in new room (exclude self by eventSpecialId)
          const availability = await CheckRoomAvailability.execute(
            newRoom,
            startTime,
            endTime,
            event.eventSpecialId
          );
          if (!availability.available) {
            throw new Error('New room is already reserved during the event time');
          }
        }

        // Update room
        event.eventRoom = newRoom;
        event.eventFormat = 'Physical';
        event.virtualLink = '';
        event.virtualDescription = '';
        await event.save({ session });

        // The generated occurrence instances of a series must follow its room
        if (eventType === 'recurring') {
          const escaped = event.eventSpecialId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          await UpcomingEvent.updateMany(
            { eventSpecialId: { $regex: `^${escaped}_` } },
            { $set: { eventRoom: event.eventRoom, eventFormat: 'Physical', virtualLink: '', virtualDescription: '' } },
            { session }
          );
        }

        return event;
      });

      // A room change does not touch the schedule, so invited people get a
      // plain email only and their calendar entries stay as they are.
      try {
        let start;
        let end;
        let recurring = null;
        if (eventType === 'recurring') {
          recurring = event.eventRecurring;
          const occ = firstRecurringOccurrence(event.eventRecurring);
          start = occ.start;
          end = occ.end;
        } else {
          start = fromUTCInstant(eventType === 'live' ? event.startedAt : event.willStartAt);
          end = fromUTCInstant(event.willEndAt);
        }
        notifyInviteesOfDetailsChange(event.eventSpecialId, {
          eventName: event.eventName,
          eventDescription: event.eventDescription || '',
          eventRoom: event.eventRoom,
          eventFormat: event.eventFormat || 'Physical',
          virtualLink: event.virtualLink || '',
          virtualDescription: event.virtualDescription || '',
          eventOrganizer: event.eventOrganizer,
          start,
          end,
          isRecurring: eventType === 'recurring',
          recurring,
        }).catch((err) => console.error('Failed to notify invitees of room change:', err.message));
      } catch (notifyError) {
        console.error('Failed to build room-change notification:', notifyError.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Event room changed successfully',
        data: event
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ChangeEventRoomController;
