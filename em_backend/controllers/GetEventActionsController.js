const EventAction = require('../models/EventActions');

class GetEventActionsController {
  static async handle(req, res) {
    try {
      const { eventSpecialId, status, date, from, to, search, assignedEmail, createdByEmail, page = 1, limit = 10 } = req.query;

      const query = {};
      if (eventSpecialId) query.eventSpecialId = eventSpecialId;
      if (status) query['currentStatus.status'] = status;
      // Only actions addressed to this person (case-insensitive exact email match)
      if (assignedEmail) {
        const escaped = assignedEmail.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query['assignedPerson.email'] = new RegExp(`^${escaped}$`, 'i');
      }
      // Only actions this person created (assigned to someone else)
      if (createdByEmail) {
        const escaped = createdByEmail.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query['createdBy.email'] = new RegExp(`^${escaped}$`, 'i');
      }
      if (from || to) {
        // Due-date range filter (inclusive of the whole "to" day)
        query.dueDate = {};
        if (from) query.dueDate.$gte = new Date(from);
        if (to) {
          const end = new Date(to);
          end.setHours(23, 59, 59, 999);
          query.dueDate.$lte = end;
        }
      } else if (date) {
        const day = new Date(date);
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        query.dueDate = { $gte: day, $lt: next };
      }
      if (search) {
        const re = new RegExp(search, 'i');
        query.$or = [
          { title: re },
          { 'assignedPerson.name': re },
          { actionDescription: re },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const totalRecords = await EventAction.countDocuments(query);
      const totalPages = Math.ceil(totalRecords / Number(limit));

      const data = await EventAction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-__v')
        .lean();

      return res.status(200).json({ success: true, totalRecords, totalPages, currentPage: Number(page), data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = GetEventActionsController;
