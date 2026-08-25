const EventAction = require('../models/EventActions');
const crypto = require('crypto');
const { sendNotificationEmail, emailShell } = require('../utilities/email');
const config = require('../configurations/config');

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

      const token = crypto.randomBytes(3).toString('hex').toUpperCase();
      tokens.set(email.toLowerCase().trim(), { token, expires: Date.now() + 15 * 60 * 1000 });

      const frontendUrl = config.frontendUrl || 'http://localhost:3000';
      const verifyUrl = `${frontendUrl}/my-tasks`;

      const htmlContent = emailShell(`
          <h2 style="color: #056daa; font-family: 'Montserrat', Arial, sans-serif; margin: 0 0 16px;">Your My Tasks Access Token</h2>
          <p style="margin: 0 0 12px;">Use the token below to access your assigned tasks:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #056daa; background: #F7F9FB; padding: 12px; text-align: center; margin: 0 0 12px;">${token}</p>
          <p style="margin: 16px 0 12px;">This token is valid for <strong>15 minutes</strong>.</p>
          <p style="margin: 0;">You can also verify your token here: <a href="${verifyUrl}" style="color: #056daa;">${verifyUrl}</a></p>`);

      const textContent = `Your My Tasks access token is: ${token}\n\nThis token is valid for 15 minutes.\n\nVerify it at: ${verifyUrl}`;

      sendNotificationEmail(email.toLowerCase().trim(), 'Your My Tasks Access Token', htmlContent, textContent).catch(err => {
        console.error('Failed to send my-tasks token email:', err);
      });

      return res.status(200).json({ success: true, message: 'Token sent to your email' });
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
