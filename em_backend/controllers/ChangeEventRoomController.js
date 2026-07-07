const mongoose = require('mongoose');
const Room = require('../models/Room');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');

class ChangeEventRoomController {
  static async handle(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { eventId, eventType, newRoom } = req.body;

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

      // Get event's time window and eventSpecialId for exclusion
      let availability;
      if (eventType === 'live') {
        availability = await CheckRoomAvailability.execute(
          newRoom,
          event.startedAt,
          event.willEndAt,
          event.eventSpecialId
        );
      } else if (eventType === 'upcoming') {
        availability = await CheckRoomAvailability.execute(
          newRoom,
          event.willStartAt,
          event.willEndAt,
          event.eventSpecialId
        );
      } else {
        // Recurring event: use the recurrence-aware check (avoids false positives
        // against live/upcoming events that fall on non-occurrence days).
        availability = await CheckRoomAvailability.executeRecurring(
          newRoom,
          event.eventRecurring,
          event.eventSpecialId
        );
      }

      if (!availability.available) {
        throw new Error(`New room is already reserved during the event time by a ${availability.conflict} event (${availability.details.eventName})`);
      }

      // Update room
      event.eventRoom = newRoom;
      await event.save({ session });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: 'Event room changed successfully',
        data: event
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

module.exports = ChangeEventRoomController;