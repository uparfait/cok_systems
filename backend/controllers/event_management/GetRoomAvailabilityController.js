const Room = require('../../models/Room');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');

class GetRoomAvailabilityController {
  static async handle(req, res) {
    try {
      const { roomName, startTime, endTime } = req.query;

      if (!roomName || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'roomName, startTime, and endTime are required'
        });
      }

      // Validate dates
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }

      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be before end time'
        });
      }

      // Check room exists
      const room = await Room.findOne({ 
        roomName: roomName.toLowerCase(),
        isActive: true 
      }).lean();

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found or inactive'
        });
      }

      // Check availability
      const availability = await CheckRoomAvailability.execute(
        roomName,
        start,
        end
      );

      return res.status(200).json({
        success: true,
        data: {
          room: {
            roomName: room.roomName,
            roomCapacity: room.roomCapacity,
            roomLocation: room.roomLocation
          },
          requestedPeriod: {
            start: start.toISOString(),
            end: end.toISOString()
          },
          available: availability.available,
          conflict: availability.available ? null : {
            type: availability.conflict,
            details: availability.details
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking room availability',
        error: error.message
      });
    }
  }
}

module.exports = GetRoomAvailabilityController;
