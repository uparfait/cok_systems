const EventAction = require('../models/EventActions');

class DeleteEventActionController {
  static async handle(req, res) {
    try {
      const { id } = req.params;
      const action = await EventAction.findByIdAndDelete(id);
      if (!action) return res.status(404).json({ success: false, message: 'Action not found' });
      return res.status(200).json({ success: true, message: 'Action deleted' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = DeleteEventActionController;
