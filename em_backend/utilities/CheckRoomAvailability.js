const Room = require('../models/Room');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const BookingRequest = require('../models/BookingRequest');
const recurrenceHelper = require('./recurrenceHelper');

class CheckRoomAvailability {
  static _escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * A generated recurring instance carries the id `${parentId}_${timestamp}`.
   * When such an instance excludes itself, its parent series must also be
   * skipped, otherwise the instance conflicts with its own series occurrence.
   */
  static _isOwnParentSeries(recurringEvent, excludeEventSpecialId) {
    return !!(
      excludeEventSpecialId &&
      String(excludeEventSpecialId).startsWith(`${recurringEvent.eventSpecialId}_`)
    );
  }

  /**
   * Returns true when two absolute time ranges overlap (touching edges do not overlap).
   */
  static _rangesOverlap(aStart, aEnd, bStart, bEnd) {
    const as = new Date(aStart).getTime();
    const ae = new Date(aEnd).getTime();
    const bs = new Date(bStart).getTime();
    const be = new Date(bEnd).getTime();
    return as < be && ae > bs;
  }

  /**
   * Fetch every conflicting event for a room across a window exactly once.
   * Completed (Past) events are intentionally excluded — they no longer occupy the room.
   */
  static async _fetchRoomEvents(roomName, start, end, excludeEventId = null, excludeRecurringPrefix = null) {
    const excludeFilter = excludeEventId
      ? { eventSpecialId: { $ne: excludeEventId } }
      : {};

    let recurringQuery = {
      eventRoom: roomName,
      'eventRecurring.recurringEndDate': { $gte: start },
      'eventRecurring.isExpired': false,
    };
    if (excludeRecurringPrefix) {
      recurringQuery.eventSpecialId = { $not: { $regex: `^${this._escapeRegex(excludeRecurringPrefix)}` } };
    } else if (excludeEventId) {
      recurringQuery.eventSpecialId = { $ne: excludeEventId };
    }

    let [live, upcoming, recurring, booking] = await Promise.all([
      LiveEvent.find({ eventRoom: roomName, ...excludeFilter, $or: [{ startedAt: { $lt: end }, willEndAt: { $gt: start } }] }).lean(),
      UpcomingEvent.find({ eventRoom: roomName, ...excludeFilter, $or: [{ willStartAt: { $lt: end }, willEndAt: { $gt: start } }] }).lean(),
      RecurringEvent.find(recurringQuery).lean(),
      BookingRequest.find({
        eventRoom: roomName,
        status: { $in: ['Pending'] },
        $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
      }).lean(),
    ]);

    // A generated instance must never conflict with its own parent series
    recurring = recurring.filter((re) => !this._isOwnParentSeries(re, excludeEventId));

    return { live, upcoming, recurring, booking };
  }

  /**
   * Build conflict descriptors from in-memory event arrays for a single [start, end] window.
   */
  static _conflictsFromEvents(events, start, end) {
    const conflicts = [];

    for (const lc of events.live) {
      if (this._rangesOverlap(lc.startedAt, lc.willEndAt, start, end)) {
        conflicts.push({ type: 'LiveEvent', eventName: lc.eventName, eventSpecialId: lc.eventSpecialId, startTime: lc.startedAt, endTime: lc.willEndAt });
      }
    }

    for (const uc of events.upcoming) {
      if (this._rangesOverlap(uc.willStartAt, uc.willEndAt, start, end)) {
        conflicts.push({ type: 'UpcomingEvent', eventName: uc.eventName, eventSpecialId: uc.eventSpecialId, startTime: uc.willStartAt, endTime: uc.willEndAt });
      }
    }

    for (const re of events.recurring) {
      if (recurrenceHelper.isRecurringOverlapping(re, start, end)) {
        conflicts.push({
          type: 'RecurringEvent',
          eventName: re.eventName,
          eventSpecialId: re.eventSpecialId,
          startTime: re.eventRecurring.eventStartTime,
          endTime: re.eventRecurring.eventEndTime,
        });
      }
    }

    for (const br of events.booking) {
      if (this._rangesOverlap(br.startTime, br.endTime, start, end)) {
        conflicts.push({ type: 'BookingRequest', eventName: br.eventName, eventSpecialId: br.trackingCode, startTime: br.startTime, endTime: br.endTime });
      }
    }

    return conflicts;
  }

  /**
   * Check if a room is available for a given time range.
   * @param {string} roomName - Room name
   * @param {Date} startTime - Start time of the requested slot
   * @param {Date} endTime - End time of the requested slot
   * @param {string|null} excludeEventSpecialId - Exact eventSpecialId to exclude (for self-conflict checks)
   * @param {string|null} excludeRecurringPrefix - Prefix to match eventSpecialIds that START WITH this
   *   (for excluding upcoming instances created FROM a recurring event, e.g. "REC_123" matches "REC_123_456")
   * @param {string|null} requestId - The ID of the booking request (if applicable)
   */
  static async execute(roomName, startTime, endTime, excludeEventSpecialId = null, excludeRecurringPrefix = null, requestId = null) {
    const room = await Room.findOne({
      roomName: roomName.toLowerCase(),
      isActive: true
    }).lean();

    if (!room) {
      throw new Error('Room not found or is inactive');
    }

    // Build the eventSpecialId exclusion filter
    let specialIdExclusion = null;
    if (excludeRecurringPrefix) {
      specialIdExclusion = { $regex: `^${this._escapeRegex(excludeRecurringPrefix)}` };
    } else if (excludeEventSpecialId) {
      specialIdExclusion = excludeEventSpecialId;
    }

    // Check LiveEvents
    const liveQuery = {
      eventRoom: roomName,
      $or: [{ startedAt: { $lt: endTime }, willEndAt: { $gt: startTime } }]
    };
    if (specialIdExclusion) {
      if (excludeRecurringPrefix) {
        liveQuery.eventSpecialId = { $not: specialIdExclusion };
      } else {
        liveQuery.eventSpecialId = { $ne: specialIdExclusion };
      }
    }

    const liveConflict = await LiveEvent.findOne(liveQuery).lean();
    if (liveConflict) return { available: false, conflict: 'LiveEvent', details: liveConflict };

    // Check UpcomingEvents
    const upcomingQuery = {
      eventRoom: roomName,
      $or: [{ willStartAt: { $lt: endTime }, willEndAt: { $gt: startTime } }]
    };
    if (specialIdExclusion) {
      if (excludeRecurringPrefix) {
        upcomingQuery.eventSpecialId = { $not: specialIdExclusion };
      } else {
        upcomingQuery.eventSpecialId = { $ne: specialIdExclusion };
      }
    }

    const upcomingConflict = await UpcomingEvent.findOne(upcomingQuery).lean();
    if (upcomingConflict) return { available: false, conflict: 'UpcomingEvent', details: upcomingConflict };

    // Check RecurringEvents
    const recurringEvents = await RecurringEvent.find({
      eventRoom: roomName,
      'eventRecurring.recurringEndDate': { $gte: startTime },
      'eventRecurring.isExpired': false
    }).lean();

    for (const recurring of recurringEvents) {
      // Skip self-exclusion for recurring events
      if (excludeEventSpecialId && recurring.eventSpecialId === excludeEventSpecialId) continue;
      if (excludeRecurringPrefix && recurring.eventSpecialId.startsWith(excludeRecurringPrefix)) continue;
      // A generated instance must never conflict with its own parent series
      if (this._isOwnParentSeries(recurring, excludeEventSpecialId)) continue;
      if (recurrenceHelper.isRecurringOverlapping(recurring, startTime, endTime)) {
        return { available: false, conflict: 'RecurringEvent', details: recurring };
      }
    }

    // Check BookingRequests (Pending or Accepted)
    const bookingRequestConflict = await BookingRequest.findOne({
      eventRoom: roomName,
      status: { $in: ['Pending'] },
      $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
      ...(requestId ? { _id: { $ne: requestId } } : {}) // Exclude the current request if provided
    }).lean();

    if (bookingRequestConflict) {
      return { available: false, conflict: 'BookingRequest', details: bookingRequestConflict };
    }

    return { available: true };
  }

  /**
   * Recurrence-aware availability check for an entire recurring schedule.
   * Checks every occurrence of the schedule against live/upcoming/recurring/booking
   * events in the room (fetched once for the whole window), so a live/upcoming event
   * that falls on a NON-occurrence day is NOT falsely reported as a conflict.
   *
   * @param {string} roomName
   * @param {object} recurringConfig - { recurringType, weeklyDays, monthlyDates, monthlyPattern, eventStartTime, eventEndTime, recurringEndDate }
   * @param {string|null} excludeEventId - eventSpecialId (and its generated instances) to exclude
   */
  static async executeRecurring(roomName, recurringConfig, excludeEventId = null) {
    const room = await Room.findOne({
      roomName: roomName.toLowerCase(),
      isActive: true
    }).lean();

    if (!room) {
      throw new Error('Room not found or is inactive');
    }

    const {
      recurringType, weeklyDays, monthlyDates, monthlyPattern,
      eventStartTime, eventEndTime, recurringEndDate
    } = recurringConfig;

    if (!recurringEndDate || !eventStartTime || !eventEndTime) {
      throw new Error('Recurring configuration is incomplete (need recurringEndDate, eventStartTime, eventEndTime).');
    }

    const [startHour, startMin] = eventStartTime.split(':').map(Number);
    const [endHour, endMin] = eventEndTime.split(':').map(Number);
    const recurrenceEnd = new Date(recurringEndDate);

    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(recurrenceEnd);
    windowEnd.setHours(23, 59, 59, 999);

    const events = await this._fetchRoomEvents(roomName, windowStart, windowEnd, excludeEventId, excludeEventId || null);
    const occurrenceDates = recurrenceHelper.generateOccurrenceDates(windowStart, recurrenceEnd, recurringType, weeklyDays, monthlyDates, monthlyPattern);

    for (const occDate of occurrenceDates) {
      const occStart = new Date(occDate);
      occStart.setHours(startHour, startMin, 0, 0);
      const occEnd = new Date(occDate);
      occEnd.setHours(endHour, endMin, 0, 0);

      if (endHour < startHour || (endHour === startHour && endMin <= startMin)) {
        occEnd.setDate(occEnd.getDate() + 1);
      }

      const conflicts = this._conflictsFromEvents(events, occStart, occEnd);
      if (conflicts.length > 0) {
        return { available: false, conflict: conflicts[0].type, details: conflicts[0] };
      }
    }

    return { available: true };
  }
}

module.exports = CheckRoomAvailability;
