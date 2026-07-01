const mongoose = require('mongoose');
const Room = require('../models/Room');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');

class DeleteRoomController {
  static async handle(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;

      // Check if room has active events
      const room = await Room.findById(id).session(session);
      if (!room) {
        throw new Error('Room not found');
      }

      const activeEvents = await Promise.all([
        LiveEvent.findOne({ eventRoom: room.roomName }).session(session),
        UpcomingEvent.findOne({ eventRoom: room.roomName }).session(session),
        RecurringEvent.findOne({ 
          eventRoom: room.roomName,
          'eventRecurring.isExpired': false 
        }).session(session)
      ]);

      if (activeEvents.some(event => event !== null)) {
        throw new Error('Cannot delete room with active events');
      }

      await Room.findByIdAndDelete(id).session(session);

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: 'Room deleted successfully'
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

module.exports = DeleteRoomController;