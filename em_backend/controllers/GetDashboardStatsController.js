const PastEvent = require('../models/PastEvent');
const EventAction = require('../models/EventActions');

class GetDashboardStatsController {
  static async handle(req, res) {
    try {
      const { from, to } = req.query;
      const startDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to) : new Date();
      endDate.setHours(23, 59, 59, 999);

      const summary = await GetDashboardStatsController._getSummaryStats(startDate, endDate);
      const taskStatus = await GetDashboardStatsController._getTaskStatusStats();

      return res.status(200).json({
        success: true,
        data: {
          summary,
          taskStatus
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving dashboard statistics',
        error: error.message
      });
    }
  }

  static async _getSummaryStats(startDate, endDate) {
    const [
      totalPastEvents,
      totalPastMeetings,
      totalCanceledEvents,
      totalCanceledMeetings
    ] = await Promise.all([
      PastEvent.countDocuments({
        startedAt: { $gte: startDate, $lte: endDate },
        isCancelled: { $ne: true }
      }),
      PastEvent.countDocuments({
        startedAt: { $gte: startDate, $lte: endDate },
        eventMeetingType: 'meet',
        isCancelled: { $ne: true }
      }),
      PastEvent.countDocuments({
        startedAt: { $gte: startDate, $lte: endDate },
        isCancelled: true
      }),
      PastEvent.countDocuments({
        startedAt: { $gte: startDate, $lte: endDate },
        eventMeetingType: 'meet',
        isCancelled: true
      })
    ]);

    return {
      totalEventsHeld: totalPastEvents,
      totalMeetingsHeld: totalPastMeetings,
      totalEventsCanceled: totalCanceledEvents,
      totalMeetingsCanceled: totalCanceledMeetings
    };
  }

  static async _getTaskStatusStats() {
    const now = new Date();
    const completed = await EventAction.countDocuments({ 'currentStatus.status': 'Completed' });
    const pending = await EventAction.countDocuments({ 'currentStatus.status': 'Pending' });
    const inProgress = await EventAction.countDocuments({ 'currentStatus.status': 'In Progress' });
    const cancelled = await EventAction.countDocuments({ 'currentStatus.status': 'Cancelled' });
    const overdue = await EventAction.countDocuments({
      dueDate: { $lt: now },
      'currentStatus.status': { $nin: ['Completed', 'Cancelled'] }
    });

    return {
      completed,
      pending,
      inProgress,
      cancelled,
      overdue
    };
  }
}

module.exports = GetDashboardStatsController;
