const GetAvailableRooms = require('../utilities/GetAvailableRooms');

class GetAvailableRoomsController {
  static async handle(req, res) {
    try {
      const { startTime, endTime, eventMode, excludeEventId, ...rest } = req.query;

      // Validate required fields
      if (!startTime || !endTime || !eventMode) {
        return res.status(400).json({
          success: false,
          message: 'startTime, endTime, and eventMode are required query parameters.',
        });
      }

      // Parse recurring config if provided
      let recurringConfig = null;
      if (eventMode === 'recurring') {
        recurringConfig = {
          recurringType: rest.recurringType || '',
          weeklyDays: rest.weeklyDays ? rest.weeklyDays.split(',').map(Number) : [],
          monthlyDates: rest.monthlyDates ? rest.monthlyDates.split(',').map(Number) : [],
          monthlyPattern: rest.monthlyPattern || 'specific',
          eventStartTime: rest.eventStartTime || '',
          eventEndTime: rest.eventEndTime || '',
          recurringEndDate: rest.recurringEndDate || '',
        };
      }

      const result = await GetAvailableRooms.execute({
        startTime,
        endTime,
        eventMode,
        recurringConfig,
        excludeEventId: excludeEventId || null,
      });

      return res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message.includes('required') || error.message.includes('must be') || error.message.includes('Invalid') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = GetAvailableRoomsController;
