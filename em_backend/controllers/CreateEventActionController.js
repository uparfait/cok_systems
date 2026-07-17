const EventAction = require('../models/EventActions');
const LiveEvent = require('../models/LiveEvent');
const { sendTaskAssignmentEmail } = require('../utilities/email');

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

      // Notify the assigned person by email (fire-and-forget — never blocks or fails the creation)
      if (action.assignedPerson?.email) {
        LiveEvent.findOne({ eventSpecialId }).lean()
          .then(ev => sendTaskAssignmentEmail(action, ev?.eventName || ''))
          .catch(err => console.error('Task assignment email failed:', err.message));
      }

      return res.status(201).json({ success: true, data: action });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = CreateEventActionController;
