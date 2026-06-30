const EventAction = require('../models/EventActions');

class GetEventActionByIdController {
  static async handle(req, res) {
    try {
      const action = await EventAction.findById(req.params.id).select('-__v').lean();
      if (!action) return res.status(404).json({ success: false, message: 'Action not found' });
      return res.status(200).json({ success: true, data: action });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = GetEventActionByIdController;
