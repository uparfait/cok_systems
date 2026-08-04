const EventAction = require('../../models/EventActions');
const crypto = require('crypto');

const tokens = new Map(); // email → { token, expires }

class GetMyTasksController {

  static async requestToken(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

      const actions = await EventAction.find({ 'assignedPerson.email': email.toLowerCase().trim() }).lean();
      if (actions.length === 0) {
        return res.status(404).json({ success: false, message: 'No tasks found for this email address' });
      }

      // 6-character alphanumeric token e.g. A3F9B2
      const token = crypto.randomBytes(3).toString('hex').toUpperCase();
      tokens.set(email.toLowerCase().trim(), { token, expires: Date.now() + 15 * 60 * 1000 });

      // Return token directly (no email service yet)
      return res.status(200).json({ success: true, token });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async verifyToken(req, res) {
    try {
      const { email, token } = req.body;
      if (!email || !token) return res.status(400).json({ success: false, message: 'Email and token are required' });

      const record = tokens.get(email.toLowerCase().trim());
      if (!record) return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      if (Date.now() > record.expires) {
        tokens.delete(email.toLowerCase().trim());
        return res.status(401).json({ success: false, message: 'Token expired. Please request a new one.' });
      }
      if (record.token !== token.toUpperCase().trim()) {
        return res.status(401).json({ success: false, message: 'Incorrect token' });
      }

      tokens.delete(email.toLowerCase().trim());

      const actions = await EventAction.find({ 'assignedPerson.email': email.toLowerCase().trim() })
        .sort({ createdAt: -1 })
        .select('-__v')
        .lean();

      return res.status(200).json({ success: true, data: actions });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = GetMyTasksController;

