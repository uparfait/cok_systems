const QRCode = require('qrcode');
const Room = require('../models/Room');

class GenerateRoomQrCodeController {
  static async handle(req, res) {
    try {
      const { roomName } = req.params;

      if (!roomName || !roomName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Room name is required',
        });
      }

      const normalizedRoomName = roomName.toLowerCase().trim();

      // Verify room exists
      const room = await Room.findOne({ roomName: normalizedRoomName, isActive: true }).lean();
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found or is inactive',
        });
      }

      if (!global.FRONTEND_URL) {
        return res.status(500).json({
          success: false,
          message: 'Error generating QR code: no frontend URL detected',
          error: 'Contact System admin: no frontend URL detected',
        });
      }

      // Build attendance URL with RoomOnly=true — no event data, the attendance form will fetch the live event
      const attendanceUrl = `${global.FRONTEND_URL}/event/${encodeURIComponent(normalizedRoomName)}/attendances/?RoomOnly=true`;

      const qrCodeDataUrl = await QRCode.toDataURL(attendanceUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          roomName: room.roomName,
          roomLocation: room.roomLocation,
          roomCapacity: room.roomCapacity,
          qrCodeDataUrl,
          attendanceUrl,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error generating room QR code',
        error: error.message,
      });
    }
  }
}

module.exports = GenerateRoomQrCodeController;