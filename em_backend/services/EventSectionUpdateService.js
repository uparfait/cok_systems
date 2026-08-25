const withTransaction = require('../utilities/withTransaction');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const Room = require('../models/Room');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');
const recurrenceHelper = require('../utilities/recurrenceHelper');
const { fromUTCInstant } = require('../utilities/eventCalendar');
const { notifyInviteesOfScheduleChange } = require('../utilities/notifyInviteesOfUpdate');

const MODELS = { live: LiveEvent, upcoming: UpcomingEvent, recurring: RecurringEvent };

class EventSectionUpdateService {
  static async execute(eventId, eventType, section, data) {
    const Model = MODELS[eventType];
    if (!Model) throw new Error('Invalid event type');

    return withTransaction(async (session) => {
      const event = await Model.findById(eventId).session(session);
      if (!event) throw new Error(`${eventType} event not found`);

      let scheduleChanged = false;

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
        case 'schedule':
          scheduleChanged = await this._updateSchedule(event, data, eventType);
          break;
        default:
          throw new Error('Invalid section. Must be basic, organizer, agenda, room, or schedule.');
      }

      await event.save({ session, validateModifiedOnly: true });

      // The schedule changed: push updated calendar invitations (same UID,
      // bumped SEQUENCE) to everyone invited so their calendars follow.
      if (scheduleChanged) {
        try {
          const startField = eventType === 'live' ? 'startedAt' : 'willStartAt';
          await notifyInviteesOfScheduleChange(event.eventSpecialId, {
            eventName: event.eventName,
            eventDescription: event.eventDescription || '',
            eventRoom: event.eventRoom,
            eventFormat: event.eventFormat || 'Physical',
            virtualLink: event.virtualLink || '',
            virtualDescription: event.virtualDescription || '',
            eventOrganizer: event.eventOrganizer,
            start: fromUTCInstant(event[startField]),
            end: fromUTCInstant(event.willEndAt),
            isRecurring: false,
            recurring: null,
          });
        } catch (emailError) {
          console.error('Failed to send schedule-change calendar updates:', emailError.message);
        }
      }

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

    // Agenda items must not overlap in time (supports "HH:MM" and legacy "09:00 AM")
    const toMinutes = (t) => {
      if (!t) return null;
      const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!m) return null;
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const ap = m[3] ? m[3].toUpperCase() : null;
      if (ap === 'PM' && h < 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      if (h > 23 || min > 59) return null;
      return h * 60 + min;
    };

    for (let i = 0; i < sanitized.length; i++) {
      const from = toMinutes(sanitized[i].fromTime);
      const to = toMinutes(sanitized[i].toTime);
      if (from === null || to === null) continue;
      if (to <= from) {
        throw new Error(`Agenda item ${i + 1}: end time must be after start time`);
      }
      for (let j = 0; j < i; j++) {
        const otherFrom = toMinutes(sanitized[j].fromTime);
        const otherTo = toMinutes(sanitized[j].toTime);
        if (otherFrom === null || otherTo === null) continue;
        if (from < otherTo && to > otherFrom) {
          throw new Error(`Agenda item ${i + 1} (${sanitized[i].fromTime} - ${sanitized[i].toTime}) overlaps with agenda item ${j + 1} (${sanitized[j].fromTime} - ${sanitized[j].toTime})`);
        }
      }
    }

    event.activityAgenda = sanitized;
  }

  static async _updateSchedule(event, data, eventType) {
    if (eventType === 'recurring') {
      throw new Error('Recurring schedules must be changed via the postpone flow');
    }

    const startField = eventType === 'live' ? 'startedAt' : 'willStartAt';

    const newStart = data[startField] !== undefined ? new Date(data[startField]) : new Date(event[startField]);
    const newEnd = data.willEndAt !== undefined ? new Date(data.willEndAt) : new Date(event.willEndAt);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      throw new Error('Invalid date or time provided');
    }
    if (newEnd <= newStart) {
      throw new Error('End time must be after start time');
    }

    // Nothing to do if the window did not actually change
    const currentStart = new Date(event[startField]).getTime();
    const currentEnd = new Date(event.willEndAt).getTime();
    if (newStart.getTime() === currentStart && newEnd.getTime() === currentEnd) {
      return false;
    }

    // Check the event's room for conflicts on the new window before saving
    // (virtual events hold no room)
    if (event.eventFormat !== 'Virtual') {
      const avail = await CheckRoomAvailability.execute(event.eventRoom, newStart, newEnd, event.eventSpecialId);
      if (!avail.available) {
        const conflictName = avail.details?.eventName ? ` (conflicts with "${avail.details.eventName}")` : '';
        throw new Error(`Room "${event.eventRoom}" is already reserved during the new time${conflictName}`);
      }
    }

    event[startField] = newStart;
    event.willEndAt = newEnd;
    return true;
  }

  static async _updateRoom(event, data, session, eventType) {
    // Switching the event to virtual releases its room; no availability checks needed.
    if (data.eventFormat === 'Virtual') {
      event.eventFormat = 'Virtual';
      event.eventRoom = 'virtual';
      if (data.virtualLink !== undefined) event.virtualLink = String(data.virtualLink).trim();
      if (data.virtualDescription !== undefined) event.virtualDescription = String(data.virtualDescription).trim();
      return;
    }

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
    if (data.eventFormat === 'Physical' || event.eventFormat === 'Virtual') {
      event.eventFormat = 'Physical';
      event.virtualLink = '';
      event.virtualDescription = '';
    }
  }
}

module.exports = EventSectionUpdateService;
