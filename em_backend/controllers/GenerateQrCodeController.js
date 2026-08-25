const QRCode = require('qrcode');
const LiveEvent = require('../models/LiveEvent');
const Room = require('../models/Room');

class GenerateQrCodeController {
  static async handle(req, res) {
    try {
      const { eventId } = req.params;

      if (!eventId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid event ID format'
        });
      }

      const liveEvent = await LiveEvent.findById(eventId).lean();

      if (!liveEvent) {
        return res.status(404).json({
          success: false,
          message: 'Live event not found'
        });
      }

      // Virtual events have no physical room — the QR simply says "Virtual"
      const isVirtual = liveEvent.eventFormat === 'Virtual';
      let room = null;

      if (!isVirtual) {
        room = await Room.findOne({
          roomName: liveEvent.eventRoom
        }).lean();

        if (!room) {
          return res.status(404).json({
            success: false,
            message: 'Room not found'
          });
        }
      }

      const displayRoom = isVirtual ? 'Virtual' : liveEvent.eventRoom;
      const displayLocation = isVirtual ? 'Virtual' : room.roomLocation;

      if(!process.env.FRONTEND_URL) {
        return res.status(500).json({
        success: false,
        message: 'Error generating QR code ::: no frontend url detected',
        error: "Contact System admin for this issue ::: no frontend url detected"
      });
      }

  
      const attendanceUrl = `${process.env.FRONTEND_URL}/event/${encodeURIComponent(liveEvent.eventSpecialId)}/attendances/?eventSpecialId=${encodeURIComponent(liveEvent.eventSpecialId)}&eventName=${encodeURIComponent(liveEvent.eventName)}&eventRoom=${encodeURIComponent(displayRoom)}&roomLocation=${encodeURIComponent(displayLocation)}&eventType=${encodeURIComponent(liveEvent.eventType)}`;

      const qrCodeDataUrl = await QRCode.toDataURL(attendanceUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          eventName: liveEvent.eventName,
          eventRoom: displayRoom,
          roomLocation: displayLocation,
          eventSpecialId: liveEvent.eventSpecialId,
          qrCodeDataUrl,
          attendanceUrl,
          event: liveEvent
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error generating QR code',
        error: error.message
      });
    }
  }
}

module.exports = GenerateQrCodeController;