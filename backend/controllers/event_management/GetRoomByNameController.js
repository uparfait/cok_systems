const Room = require('../../models/Room');

class GetRoomByNameController {
  static async handle(req, res) {
    try {
      const { roomName } = req.params;

      if (!roomName || !roomName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Room name is required'
        });
      }

      const room = await Room.findOne({
        roomName: roomName.toLowerCase().trim()
      })
      .select('-__v')
      .lean();

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: room
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving room',
        error: error.message
      });
    }
  }
}

module.exports = GetRoomByNameController;
