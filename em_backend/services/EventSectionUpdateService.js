const withTransaction = require('../utilities/withTransaction');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const Room = require('../models/Room');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');
const recurrenceHelper = require('../utilities/recurrenceHelper');

const MODELS = { live: LiveEvent, upcoming: UpcomingEvent, recurring: RecurringEvent };

class EventSectionUpdateService {
  static async execute(eventId, eventType, section, data) {
    const Model = MODELS[eventType];
    if (!Model) throw new Error('Invalid event type');

    return withTransaction(async (session) => {
      const event = await Model.findById(eventId).session(session);
      if (!event) throw new Error(`${eventType} event not found`);

      switch (section) {
        case 'basic':
          this._updateBasic(event, data);
          break;
        case 'organizer':
          this._updateOrganizer(event, data);
          break;
        case 'agenda':
          this._updateAgenda(event, data);
          break;
        case 'room':
          await this._updateRoom(event, data, session, eventType);
          break;
        default:
          throw new Error('Invalid section. Must be basic, organizer, agenda, or room.');
      }

      await event.save({ session, validateModifiedOnly: true });

      return { success: true, data: event };
    });
  }

  static _updateBasic(event, data) {
    if (data.eventName !== undefined) {
      if (!data.eventName.trim()) throw new Error('Event name cannot be empty');
      if (data.eventName.length > 500) throw new Error('Event name too long');
      event.eventName = data.eventName.trim();
    }
    if (data.eventType !== undefined) {
      if (!['Internal', 'Joint', 'External'].includes(data.eventType)) {
        throw new Error('Event type must be Internal, Joint or External');
      }
      event.eventType = data.eventType;
    }
    if (data.eventDescription !== undefined) {
      if (!data.eventDescription.trim()) throw new Error('Description cannot be empty');
      if (data.eventDescription.length > 2000) throw new Error('Description too long');
      event.eventDescription = data.eventDescription.trim();
    }
    if (data.expectedAudience !== undefined) {
      const val = Number(data.expectedAudience);
      if (isNaN(val) || val < 1) throw new Error('Expected audience must be at least 1');
      event.expectedAudience = val;
    }
    if (data.eventRecurring && event.eventRecurring) {
      if (data.eventRecurring.eventStartTime) {
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.eventRecurring.eventStartTime)) {
          throw new Error('Start time must be HH:MM format');
        }
        event.eventRecurring.eventStartTime = data.eventRecurring.eventStartTime;
      }
      if (data.eventRecurring.eventEndTime) {
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.eventRecurring.eventEndTime)) {
          throw new Error('End time must be HH:MM format');
        }
        event.eventRecurring.eventEndTime = data.eventRecurring.eventEndTime;
      }
      if (data.eventRecurring.recurringEndDate) {
        const d = new Date(data.eventRecurring.recurringEndDate);
        if (isNaN(d.getTime())) throw new Error('Invalid recurring end date');
        event.eventRecurring.recurringEndDate = d;
      }
    }
  }

  static _updateOrganizer(event, data) {
    const org = event.eventOrganizer || {};
    if (!data.eventOrganizer || typeof data.eventOrganizer !== 'object') {
      throw new Error('Organizer data must be an object');
    }
    const { fullNames, email, phone, institution } = data.eventOrganizer;

    if (fullNames !== undefined) {
      if (!fullNames.trim()) throw new Error('Organizer name cannot be empty');
      if (fullNames.length > 200) throw new Error('Organizer name too long');
      org.fullNames = fullNames.trim();
    }
    if (email !== undefined) {
      if (!email.trim()) throw new Error('Organizer email cannot be empty');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
      org.email = email.trim().toLowerCase();
    }
    if (phone !== undefined) {
      if (!phone.trim()) throw new Error('Organizer phone cannot be empty');
      org.phone = phone.trim();
    }
    if (institution !== undefined) {
      org.institution = institution.trim();
    }

    event.eventOrganizer = org;
  }

  static _updateAgenda(event, data) {
    if (!data.activityAgenda || !Array.isArray(data.activityAgenda)) {
      throw new Error('Activity agenda must be an array');
    }
    const sanitized = data.activityAgenda
      .filter(p => p.title?.trim() || p.description?.trim() || p.fromTime?.trim() || p.toTime?.trim())
      .map(p => ({
        fromTime: p.fromTime?.trim() || '',
        toTime: p.toTime?.trim() || '',
        title: p.title?.trim() || '',
        description: p.description?.trim() || '',
      }));
    event.activityAgenda = sanitized;
  }

  static async _updateRoom(event, data, session, eventType) {
    if (!data.eventRoom || !data.eventRoom.trim()) {
      throw new Error('Room name is required');
    }
    const newRoom = data.eventRoom.toLowerCase().trim();

    const room = await Room.findOne({ roomName: newRoom, isActive: true }).session(session);
    if (!room) throw new Error('Room not found or is inactive');

    if (eventType === 'recurring' && event.eventRecurring) {
      const { eventStartTime, eventEndTime, recurringEndDate, recurringType, weeklyDays, monthlyDates, monthlyPattern } = event.eventRecurring;
      if (!eventStartTime || !eventEndTime || !recurringEndDate) {
        throw new Error('Recurring event configuration is incomplete for availability check');
      }

      const now = new Date();
      const [sH, sM] = eventStartTime.split(':').map(Number);
      const [eH, eM] = eventEndTime.split(':').map(Number);
      const recurrenceEnd = new Date(recurringEndDate);

      const occurrenceDates = recurrenceHelper.generateOccurrenceDates(
        now,
        recurrenceEnd,
        recurringType,
        weeklyDays,
        monthlyDates,
        monthlyPattern
      );

      if (occurrenceDates.length === 0) {
        throw new Error('No future occurrences found for this recurring event');
      }

      const conflicts = [];
      for (const occDate of occurrenceDates) {
        const occStart = new Date(occDate);
        occStart.setHours(sH, sM, 0, 0);

        const occEnd = new Date(occDate);
        occEnd.setHours(eH, eM, 0, 0);

        if (eH < sH || (eH === sH && eM <= sM)) {
          occEnd.setDate(occEnd.getDate() + 1);
        }

        if (occStart <= now) continue;

        const avail = await CheckRoomAvailability.execute(newRoom, occStart, occEnd, event.eventSpecialId);
        if (!avail.available) {
          conflicts.push({
            date: occDate.toLocaleDateString(),
            time: `${eventStartTime}-${eventEndTime}`,
            conflict: avail.conflict,
            eventName: avail.details?.eventName || 'Unknown',
          });
        }
      }

      if (conflicts.length > 0) {
        const conflictDetails = conflicts.slice(0, 3).map(c => `"${c.date} ${c.time}" (conflicts with "${c.eventName}")`).join(', ');
        const remaining = conflicts.length - 3;
        const suffix = remaining > 0 ? ` and ${remaining} more occurrence(s)` : '';
        throw new Error(`New room is already reserved during ${conflictDetails}${suffix}`);
      }
    } else {
      const start = eventType === 'live' ? new Date() : (event.willStartAt || event.startedAt);
      const end = event.willEndAt;
      if (start && end) {
        const avail = await CheckRoomAvailability.execute(newRoom, start, end, event.eventSpecialId);
        if (!avail.available) throw new Error('New room is already reserved during the event time');
      }
    }

    event.eventRoom = newRoom;
  }
}

module.exports = EventSectionUpdateService;
