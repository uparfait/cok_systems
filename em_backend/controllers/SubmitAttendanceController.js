const Attendance = require('../models/Attendance');
const LiveEvent = require('../models/LiveEvent');
const config = require('../configurations/config');

class SubmitAttendanceController {
  static async handle(req, res) {
    try {
      const {
        attendeeFullName,
        attendeeEmail,
        attendeePhoneNumber,
        attendeeInstitution,
        attendeePosition,
        eventSpecialId,
        attendeeSignature,
        signatureMethod,
        eventName,
        eventRoom,
        roomLocation,
      } = req.body;

      if (!attendeeFullName || !attendeePhoneNumber || !attendeeInstitution || !attendeePosition || !eventSpecialId) {
        return res.status(400).json({
          success: false,
          message: 'Full name, phone number, institution, position, and event ID are required'
        });
      }

      if (attendeeEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(attendeeEmail)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid email format'
          });
        }
      }

      if (attendeeSignature) {
        if (typeof attendeeSignature !== 'string' || !attendeeSignature.startsWith('data:image/png;base64,')) {
          return res.status(400).json({
            success: false,
            message: 'Signature must be a PNG image data URL'
          });
        }
        if (attendeeSignature.length > 200000) {
          return res.status(400).json({
            success: false,
            message: 'Signature image is too large'
          });
        }
      }

      const liveEvent = await LiveEvent.findOne({ eventSpecialId });
      if (!liveEvent) {
        return res.status(404).json({
          success: false,
          message: 'Event not found or no longer active'
        });
      }

      // Prevent duplicate attendance by phone number
      const existingAttendance = await Attendance.findOne({
        eventSpecialId,
        attendeePhoneNumber: attendeePhoneNumber.trim()
      });

      if (existingAttendance) {
        return res.status(409).json({
          success: false,
          message: 'Attendance for this phone number has already been recorded for this event'
        });
      }

      const hasDigitalCertificate = req.file
        ? `${config.api.basePath}/uploads/${req.file.filename}`
        : undefined;

      const attendance = new Attendance({
        attendeeFullName: attendeeFullName.trim(),
        attendeeEmail: attendeeEmail ? attendeeEmail.toLowerCase().trim() : undefined,
        attendeePhoneNumber: attendeePhoneNumber.trim(),
        attendeeInstitution: attendeeInstitution.trim(),
        attendeePosition: attendeePosition.trim(),
        eventSpecialId,
        eventName: eventName || undefined,
        eventRoom: eventRoom || undefined,
        roomLocation: roomLocation || undefined,
        attendeeSignature: attendeeSignature || undefined,
        digitalCertificate: hasDigitalCertificate,
        signatureMethod: signatureMethod || undefined,
        attendanceTime: new Date(),
      });

      await attendance.save();

      return res.status(201).json({
        success: true,
        message: 'Attendance recorded successfully',
        data: {
          attendeeFullName: attendance.attendeeFullName,
          attendeeEmail: attendance.attendeeEmail,
          attendanceTime: attendance.attendanceTime,
          signatureMethod: attendance.signatureMethod,
          hasSignature: !!attendance.attendeeSignature,
          hasDigitalCertificate: !!attendance.digitalCertificate,
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error recording attendance',
        error: error.message
      });
    }
  }
}

module.exports = SubmitAttendanceController;
