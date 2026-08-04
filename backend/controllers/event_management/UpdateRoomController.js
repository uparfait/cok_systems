const Room = require('../../models/Room');
const RoomValidator = require('../validators/RoomValidator');

class UpdateRoomController {
  static async handle(req, res) {
    try {
      const { id } = req.params;

      // Validate input
      const validation = RoomValidator.validate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.errors.join(', ')
        });
      }

      // Sanitize input
      const sanitizedData = RoomValidator.sanitize(req.body);

      // Find and update room
      const room = await Room.findByIdAndUpdate(
        id,
        sanitizedData,
        { new: true, runValidators: true }
      );

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Room updated successfully',
        data: room
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'A room with this name already exists'
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = UpdateRoomController;
