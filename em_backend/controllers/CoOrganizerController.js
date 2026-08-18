const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');

const COLLECTIONS = [LiveEvent, UpcomingEvent, RecurringEvent, PastEvent];

async function findEventDoc(eventSpecialId) {
  for (const Model of COLLECTIONS) {
    const event = await Model.findOne({ eventSpecialId });
    if (event) return event;
  }
  const parent = String(eventSpecialId).split('_')[0];
  if (parent && parent !== eventSpecialId) {
    for (const Model of COLLECTIONS) {
      const event = await Model.findOne({ eventSpecialId: parent });
      if (event) return event;
    }
  }
  return null;
}

class CoOrganizerController {

  static async list(req, res) {
    try {
      const { eventSpecialId } = req.params;
      const event = await findEventDoc(eventSpecialId);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      return res.status(200).json({ success: true, data: event.coOrganizers || [] });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async add(req, res) {
    try {
      const { eventSpecialId } = req.params;
      const { fullNames, email, phone, institution } = req.body;

      if (!fullNames || !String(fullNames).trim()) {
        return res.status(400).json({ success: false, message: 'Co-organizer full names are required' });
      }
      if (!email || !String(email).trim()) {
        return res.status(400).json({ success: false, message: 'Co-organizer email is required' });
      }
      if (!phone || !String(phone).trim()) {
        return res.status(400).json({ success: false, message: 'Co-organizer phone number is required' });
      }

      const event = await findEventDoc(eventSpecialId);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      if ((event.eventOrganizer?.email || '').toLowerCase() === normalizedEmail) {
        return res.status(400).json({ success: false, message: 'This person is already the organizer of the event' });
      }
      const existing = (event.coOrganizers || []).some(
        (c) => (c.email || '').toLowerCase() === normalizedEmail
      );
      if (existing) {
        return res.status(400).json({ success: false, message: 'This person is already a co-organizer' });
      }

      event.coOrganizers = event.coOrganizers || [];
      event.coOrganizers.push({
        fullNames: String(fullNames).trim(),
        email: normalizedEmail,
        phone: String(phone).trim(),
        institution: String(institution || '').trim(),
      });
      await event.save();

      return res.status(200).json({
        success: true,
        message: 'Co-organizer added successfully',
        data: event.coOrganizers,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = CoOrganizerController;
