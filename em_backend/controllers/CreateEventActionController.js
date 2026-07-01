const EventAction = require('../models/EventActions');

class CreateEventActionController {
  static async handle(req, res) {
    try {
      const { title, actionDescription, assignedPerson, dueDate, currentStatus, eventSpecialId, createdBy } = req.body;

      const action = await EventAction.create({
        title,
        actionDescription,
        assignedPerson,
        dueDate,
        currentStatus,
        eventSpecialId,
        createdBy,
        statusHistory: [{
          status: currentStatus.status,
          description: currentStatus.description,
        }],
      });

      return res.status(201).json({ success: true, data: action });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = CreateEventActionController;
