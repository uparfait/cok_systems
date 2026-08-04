const Room = require('../../models/Room');

class GetRoomsController {
  static async handle(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'new',
        filter,
        search,
        searchField,
        minCapacity,
        maxCapacity,
        isActive
      } = req.query;

      const queryObject = {};

      // Filter by active status (default: show only active rooms)
      if (isActive !== undefined) {
        queryObject.isActive = isActive;
      }

      // Apply search
      if (search && searchField) {
        const validSearchFields = ['roomName', 'roomLocation', 'roomDescription'];
        if (validSearchFields.includes(searchField)) {
          queryObject[searchField] = { $regex: search, $options: 'i' };
        }
      } else if (search) {
        // If no searchField specified, search across multiple fields
        queryObject.$or = [
          { roomName: { $regex: search, $options: 'i' } },
          { roomLocation: { $regex: search, $options: 'i' } },
          { roomDescription: { $regex: search, $options: 'i' } }
        ];
      }

      // Apply capacity filters
      if (minCapacity || maxCapacity) {
        queryObject.roomCapacity = {};
        if (minCapacity) {
          queryObject.roomCapacity.$gte = parseInt(minCapacity);
        }
        if (maxCapacity) {
          queryObject.roomCapacity.$lte = parseInt(maxCapacity);
        }
      }

      // Apply time-based filters
      if (filter) {
        const now = new Date();
        switch (filter) {
          case 'thisWeek':
            { const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
            const weekEnd = new Date(now.setDate(now.getDate() - now.getDay() + 7));
            queryObject.createdAt = { $gte: weekStart, $lte: weekEnd };
            break; }
          case 'thisMonth':
            { const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            queryObject.createdAt = { $gte: monthStart, $lte: monthEnd };
            break; }
          case 'thisYear':
            { const yearStart = new Date(now.getFullYear(), 0, 1);
            const yearEnd = new Date(now.getFullYear(), 11, 31);
            queryObject.createdAt = { $gte: yearStart, $lte: yearEnd };
            break; }
          case 'recentlyUpdated':
            // Rooms updated in the last 7 days
            { const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            queryObject.updatedAt = { $gte: sevenDaysAgo };
            break; }
          case 'inactive':
            queryObject.isActive = false;
            break;
        }
      }

      // Sort
      const sortObject = {};
      switch (sort) {
        case 'old':
          sortObject.createdAt = 1;
          break;
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
        case 'updated':
          sortObject.updatedAt = -1;
          break;
        default:
          sortObject.createdAt = -1;
      }

      // Get paginated results
      const totalRecords = await Room.countDocuments(queryObject);
      const totalPages = Math.ceil(totalRecords / limit);
      const currentPage = parseInt(page);

      const data = await Room.find(queryObject)
        .sort(sortObject)
        .skip((currentPage - 1) * limit)
        .limit(parseInt(limit))
        .select('-__v')
        .lean();

      return res.status(200).json({
        success: true,
        totalRecords,
        totalPages,
        currentPage,
        limit: parseInt(limit),
        data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving rooms',
        error: error.message
      });
    }
  }
}

module.exports = GetRoomsController;
