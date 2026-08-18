const EventAction = require('../models/EventActions');

class UpdateEventActionController {
  static async handle(req, res) {
    try {
      const { id } = req.params;
      const { title, actionDescription, assignedPerson, dueDate, currentStatus, changedBy, createdBy } = req.body;

      const action = await EventAction.findById(id);
      if (!action) return res.status(404).json({ success: false, message: 'Action not found' });

      const statusChanged = currentStatus?.status && currentStatus.status !== action.currentStatus.status;

      action.title             = title             ?? action.title;
      action.actionDescription = actionDescription ?? action.actionDescription;
      action.assignedPerson    = assignedPerson    ?? action.assignedPerson;
      action.dueDate           = dueDate           ?? action.dueDate;
      action.createdBy         = createdBy         ?? action.createdBy;

      if (currentStatus) {
        action.currentStatus = currentStatus;
        if (statusChanged) {
          const entry = {
            status:      currentStatus.status,
            description: currentStatus.description,
          };

          // Record who made this change on the history entry
          if (changedBy && (changedBy.name || changedBy.email)) {
            entry.changedBy = { name: changedBy.name, email: changedBy.email };
          }

          // Attach uploaded file info if present (single 'document' field or
          // multiple 'documents' field, both supported)
          const uploaded = [
            ...(req.file ? [req.file] : []),
            ...(req.files?.document || []),
            ...(req.files?.documents || []),
          ];
          if (uploaded.length > 0) {
            const toDoc = (f) => ({
              filename:     f.filename,
              originalName: f.originalname,
              mimetype:     f.mimetype,
              size:         f.size,
              url:          `/uploads/${f.filename}`,
            });
            entry.document  = toDoc(uploaded[0]); // backward compatibility
            entry.documents = uploaded.map(toDoc);
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
