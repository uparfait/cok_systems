const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');
const crypto = require('crypto');
const { sendNotificationEmail } = require('../utilities/email');
const config = require('../configurations/config');

const accessTokens = new Map();
const pendingTokens = new Map();

class EventAccessController {

  static async requestToken(req, res) {
    try {
      const { eventSpecialId, email } = req.body;
      if (!eventSpecialId || !email) {
        return res.status(400).json({ success: false, message: 'Event ID and email are required' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      const collections = [LiveEvent, UpcomingEvent, RecurringEvent, PastEvent];
      let event = null;

      for (const Model of collections) {
        event = await Model.findOne({ eventSpecialId }).lean();
        if (event) break;
      }

      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      const organizerEmail = event.eventOrganizer?.email?.toLowerCase().trim();
      const isCoOrganizer = (event.coOrganizers || []).some(
        (c) => (c.email || '').toLowerCase().trim() === normalizedEmail
      );
      if (organizerEmail !== normalizedEmail && !isCoOrganizer) {
        return res.status(403).json({ success: false, message: 'This email is not authorized for this event' });
      }

      const token = crypto.randomBytes(3).toString('hex').toUpperCase();
      pendingTokens.set(`${normalizedEmail}:${eventSpecialId}`, {
        token,
        expires: Date.now() + 15 * 60 * 1000,
        eventSpecialId,
      });

      const frontendUrl = config.frontendUrl || 'http://localhost:5173';
      const verifyUrl = `${frontendUrl}/event/${encodeURIComponent(eventSpecialId)}/details`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; color: #1f2937;">
          <h2 style="color: #056daa;">Event Access Token</h2>
          <p>Use the token below to access event details:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #056daa; background: #f3f4f6; padding: 12px; text-align: center; border-radius: 8px;">${token}</p>
          <p style="margin-top: 16px;">This token is valid for <strong>15 minutes</strong>.</p>
          <p style="margin-top: 16px;">Verify your token here: <a href="${verifyUrl}" style="color: #056daa;">${verifyUrl}</a></p>
          <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #6b7280;">City of Kigali  Event Management System</p>
        </div>`;

      const textContent = `Your event access token is: ${token}\n\nThis token is valid for 15 minutes.\n\nVerify it at: ${verifyUrl}\n\nCity of Kigali - Event Management System`;

      sendNotificationEmail(normalizedEmail, 'Event Access Token', htmlContent, textContent).catch(err => {
        console.error('Failed to send event access token email:', err);
      });

      return res.status(200).json({ success: true, message: 'Token sent to your email' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async verifyToken(req, res) {
    try {
      const { eventSpecialId, email, token } = req.body;
      if (!eventSpecialId || !email || !token) {
        return res.status(400).json({ success: false, message: 'Event ID, email and token are required' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const key = `${normalizedEmail}:${eventSpecialId}`;
      const record = pendingTokens.get(key);

      if (!record) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
      if (Date.now() > record.expires) {
        pendingTokens.delete(key);
        return res.status(401).json({ success: false, message: 'Token expired. Please request a new one.' });
      }
      if (record.token !== token.toUpperCase().trim()) {
        return res.status(401).json({ success: false, message: 'Incorrect token' });
      }

      pendingTokens.delete(key);

      const accessToken = crypto.randomBytes(24).toString('hex');
      accessTokens.set(accessToken, {
        eventSpecialId,
        email: normalizedEmail,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({ success: true, data: { accessToken, eventSpecialId } });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static validateToken(req, res, next) {
    try {
      const token = req.headers['x-event-access-token'];
      if (!token) return next();

      const record = accessTokens.get(token);
      if (!record || Date.now() > record.expires) {
        if (record) accessTokens.delete(token);
        return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
      }

      req.eventAccess = record;
      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async validate(req, res) {
    try {
      const token = req.headers['x-event-access-token'];
      if (!token) {
        return res.status(400).json({ success: false, message: 'Access token required' });
      }
      const record = accessTokens.get(token);
      if (!record || Date.now() > record.expires) {
        if (record) accessTokens.delete(token);
        return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
      }
      return res.status(200).json({ success: true, data: { eventSpecialId: record.eventSpecialId } });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = EventAccessController;
