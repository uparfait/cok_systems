const Room = require('../models/Room');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');

class GetActiveRoomsController {
  static async handle(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'name',
        includeEventCount = 'false'
      } = req.query;

      const queryObject = {
        isActive: true
      };

      

      const sortObject = {};
      switch (sort) {
        case 'name':
          sortObject.roomName = 1;
          break;
        case 'nameDesc':
          sortObject.roomName = -1;
          break;
        case 'capacity':
          sortObject.roomCapacity = 1;
          break;
        case 'capacityDesc':
          sortObject.roomCapacity = -1;
          break;
        case 'location':
          sortObject.roomLocation = 1;
          break;
        default:
          sortObject.roomName = 1;
      }

      const totalRecords = await Room.countDocuments(queryObject);
      const totalPages = Math.ceil(totalRecords / limit);

      const rooms = await Room.find(queryObject)
        .sort(sortObject)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('-__v')
        .lean();

      // If requested, include event counts for each room
      if (includeEventCount === 'true') {
        const roomsWithCounts = await Promise.all(rooms.map(async (room) => {
          const [liveCount, upcomingCount] = await Promise.all([
            LiveEvent.countDocuments({ eventRoom: room.roomName }),
            UpcomingEvent.countDocuments({ eventRoom: room.roomName })
          ]);

          return {
            ...room,
            activeEventsCount: liveCount + upcomingCount,
            liveEventsCount: liveCount,
            upcomingEventsCount: upcomingCount
          };
        }));

        return res.status(200).json({
          success: true,
          totalRecords,
          totalPages,
          currentPage: parseInt(page),
          data: roomsWithCounts
        });
      }

      return res.status(200).json({
        success: true,
        totalRecords,
        totalPages,
        currentPage: parseInt(page),
        data: rooms
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving active rooms',
        error: error.message
      });
    }
  }
}

module.exports = GetActiveRoomsController;