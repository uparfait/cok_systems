const Room = require('../models/Room');
const RoomValidator = require('../validators/RoomValidator');

class CreateRoomController {
  static async handle(req, res) {
    try {
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

      // Create room
      const room = new Room(sanitizedData);

      await room.save();

      return res.status(201).json({
        success: true,
        message: 'Room created successfully',
        data: room
      });
    } catch (error) {
      // Handle duplicate key error
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

module.exports = CreateRoomController;