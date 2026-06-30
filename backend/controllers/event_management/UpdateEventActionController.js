const EventAction = require('../models/EventActions');

class UpdateEventActionController {
  static async handle(req, res) {
    try {
      const { id } = req.params;
      const { title, actionDescription, assignedPerson, dueDate, currentStatus } = req.body;

      const action = await EventAction.findById(id);
      if (!action) return res.status(404).json({ success: false, message: 'Action not found' });

      const statusChanged = currentStatus?.status && currentStatus.status !== action.currentStatus.status;

      action.title             = title             ?? action.title;
      action.actionDescription = actionDescription ?? action.actionDescription;
      action.assignedPerson    = assignedPerson    ?? action.assignedPerson;
      action.dueDate           = dueDate           ?? action.dueDate;

      if (currentStatus) {
        action.currentStatus = currentStatus;
        if (statusChanged) {
          const entry = {
            status:      currentStatus.status,
            description: currentStatus.description,
          };

          // Attach uploaded file info if present
          if (req.file) {
            entry.document = {
              filename:     req.file.filename,
              originalName: req.file.originalname,
              mimetype:     req.file.mimetype,
              size:         req.file.size,
              url:          `/uploads/${req.file.filename}`,
            };
          }

          action.statusHistory.push(entry);
        }
      }

      await action.save();
      return res.status(200).json({ success: true, data: action });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = UpdateEventActionController;
