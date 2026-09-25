const Attendance = require('../models/Attendance');
const { event_special_id_match } = require('../utilities/eventSpecialId');
const { toSignatureDataUrl } = require('../utilities/signatureImage');

// The signature blob is sent back as a data URL so existing views render it unchanged.
// The signed bytes and the raw certificate stay on the server; nothing needs them in the browser.
function presentAttendance(record) {
  const { signatureImage, signatureImageType, certificateSignature, ...rest } = record;

  const dataUrl = toSignatureDataUrl(record);
  if (dataUrl) rest.attendeeSignature = dataUrl;

  if (certificateSignature && certificateSignature.subjectCommonName) {
    rest.certificateSignature = {
      subjectCommonName: certificateSignature.subjectCommonName,
      subjectOrganization: certificateSignature.subjectOrganization,
      subjectEmail: certificateSignature.subjectEmail,
      issuerCommonName: certificateSignature.issuerCommonName,
      serialNumber: certificateSignature.serialNumber,
      thumbprint: certificateSignature.thumbprint,
      signedAt: certificateSignature.signedAt,
      verifiedAt: certificateSignature.verifiedAt,
      chainVerified: certificateSignature.chainVerified,
      nameMatchedTypedName: certificateSignature.nameMatchedTypedName,
    };
  }

  return rest;
}

class GetAttendanceController {
  static async handle(req, res) {
    try {
      const {
        
        eventSpecialId,
        eventName,
        eventRoom,
        roomLocation,
        attendeeEmail,
        search
      } = req.query;

      const sort = 'old';

      const queryObject = {};

      // Apply filters
      if (eventSpecialId) {
        // Matched under both spellings of the event's id. Attendance is
        // submitted to a LIVE event, so it carries the short id; once the
        // event ends the page asks with the `<id>__<timestamp>` the past
        // event was stored under, and an exact match would find none of it.
        queryObject.eventSpecialId = event_special_id_match(eventSpecialId);
      }

      if (eventName) {
        queryObject.eventName = { $regex: eventName, $options: 'i' };
      }

      if (eventRoom) {
        queryObject.eventRoom = { $regex: eventRoom, $options: 'i' };
      }

      if (roomLocation) {
        queryObject.roomLocation = { $regex: roomLocation, $options: 'i' };
      }

      if (attendeeEmail) {
        queryObject.attendeeEmail = { $regex: attendeeEmail, $options: 'i' };
      }

      // Apply search across multiple fields
      if (search) {
        queryObject.$or = [
          { attendeeName: { $regex: search, $options: 'i' } },
          { attendeeEmail: { $regex: search, $options: 'i' } },
          { eventName: { $regex: search, $options: 'i' } },
          { eventRoom: { $regex: search, $options: 'i' } }
        ];
      }

      // Sort
      const sortObject = {};
      switch (sort) {
        case 'old':
          sortObject.attendanceTime = 1;
          break;
        case 'name':
          sortObject.attendeeName = 1;
          break;
        case 'event':
          sortObject.eventName = 1;
          break;
        default:
          sortObject.attendanceTime = -1;
      }

      const totalRecords = await Attendance.countDocuments(queryObject);
      

      const data = await Attendance.find(queryObject)
        .sort(sortObject)
        .select('-__v')
        .lean();

      return res.status(200).json({
        success: true,
        totalRecords,
        totalPages: 1,
        currentPage: 1,
        data: data.map(presentAttendance)
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving attendance records',
        error: error.message
      });
    }
  }
}

module.exports = GetAttendanceController;