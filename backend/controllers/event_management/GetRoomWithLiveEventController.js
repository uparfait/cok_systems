const Room = require('../models/Room');
const LiveEvent = require('../models/LiveEvent');

class GetRoomWithLiveEventController {
  static async handle(req, res) {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid room ID format'
        });
      }

      const room = await Room.findById(id).select('-__v').lean();

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      const liveEvent = await LiveEvent.findOne({
        eventRoom: room.roomName
      })
      .sort({ startedAt: -1 })
      .lean();

      return res.status(200).json({
        success: true,
        data: {
          room,
          liveEvent: liveEvent || null
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving room with live event',
        error: error.message
      });
    }
  }
}

module.exports = GetRoomWithLiveEventController;