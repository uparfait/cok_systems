const EventAction = require('../models/EventActions');

class CreateEventActionController {
  static async handle(req, res) {
    try {
      const { title, actionDescription, assignedPerson, dueDate, currentStatus, eventSpecialId, createdBy } = req.body;

      // Standalone follow-ups (created from the follow-ups board) have no event
      const resolvedEventId = eventSpecialId || 'FOLLOWUP';

      const action = await EventAction.create({
        title,
        actionDescription,
        assignedPerson,
        dueDate,
        currentStatus,
        eventSpecialId: resolvedEventId,
        createdBy,
        statusHistory: [{
          status: currentStatus.status,
          description: currentStatus.description,
          changedBy: createdBy ? { name: createdBy.name, email: createdBy.email } : undefined,
        }],
      });

      return res.status(201).json({ success: true, data: action });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = CreateEventActionController;
