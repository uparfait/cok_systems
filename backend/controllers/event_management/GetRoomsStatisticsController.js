const Room = require('../../models/Room');
const LiveEvent = require('../../models/LiveEvent');
const UpcomingEvent = require('../../models/UpcomingEvent');

class GetRoomsStatisticsController {
  static async handle(req, res) {
    try {
      const [
        totalRooms,
        activeRooms,
        inactiveRooms,
        totalCapacity,
        averageCapacity,
        roomsWithEvents
      ] = await Promise.all([
        Room.countDocuments(),
        Room.countDocuments({ isActive: true }),
        Room.countDocuments({ isActive: false }),
        Room.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: null, total: { $sum: '$roomCapacity' } } }
        ]),
        Room.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: null, avg: { $avg: '$roomCapacity' } } }
        ]),
        // Get rooms that currently have events
        Promise.all([
          LiveEvent.distinct('eventRoom'),
          UpcomingEvent.distinct('eventRoom')
        ])
      ]);

      // Combine and deduplicate rooms with events
      const allEventRooms = [...new Set([...roomsWithEvents[0], ...roomsWithEvents[1]])];

      // Get location statistics
      const locationStats = await Room.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$roomName',
            count: { $sum: 1 },
            totalCapacity: { $sum: '$roomCapacity' }
          }
        },
        { $sort: { totalCapacity: -1 } },
        { $limit: 10 }
      ]);

      return res.status(200).json({
        success: true,
        data: {
          overview: {
            totalRooms,
            activeRooms,
            inactiveRooms,
            occupiedRooms: allEventRooms.length,
            availableRooms: activeRooms - allEventRooms.length
          },
          capacity: {
            totalCapacity: totalCapacity[0]?.total || 0,
            averageCapacity: Math.round(averageCapacity[0]?.avg || 0)
          },
          topLocations: locationStats.map(loc => ({
            location: loc._id,
            roomCount: loc.count,
            totalCapacity: loc.totalCapacity
          }))
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving room statistics',
        error: error.message
      });
    }
  }
}

module.exports = GetRoomsStatisticsController;
