const Attendance = require('../../models/Attendance');

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
        queryObject.eventSpecialId = eventSpecialId;
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
        data
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
