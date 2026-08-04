const Room = require('../../models/Room');

class GetRoomByIdController {
  static async handle(req, res) {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid room ID format'
        });
      }

      const room = await Room.findById(id)
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

module.exports = GetRoomByIdController;
