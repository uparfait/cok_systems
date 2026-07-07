const Room = require('../models/Room');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const BookingRequest = require('../models/BookingRequest');
const recurrenceHelper = require('./recurrenceHelper');

class GetAvailableRooms {
  /**
   * Get all rooms with detailed availability for a requested time period
   */
  static async execute({ startTime, endTime, eventMode, recurringConfig = null, excludeEventId = null }) {
    this._validateInputs(startTime, endTime, eventMode, recurringConfig);

    const start = new Date(startTime);
    const end = new Date(endTime);
    const rooms = await Room.find({ isActive: true }).lean();

    if (!rooms || rooms.length === 0) {
      return this._emptyResponse(start, end, eventMode);
    }

    const { availableRooms, unavailableRooms } = await this._processAllRooms(rooms, start, end, eventMode, recurringConfig, excludeEventId);
    const summary = this._buildSummary(availableRooms, unavailableRooms, start, end, eventMode, recurringConfig);

    return {
      success: true,
      message: summary,
      data: {
        requestedPeriod: { start, end },
        eventMode,
        recurringConfig: eventMode === 'recurring' ? recurringConfig : undefined,
        totalRooms: rooms.length,
        availableCount: availableRooms.length,
        unavailableCount: unavailableRooms.length,
        availableRooms,
        unavailableRooms,
        summary,
      },
    };
  }

  static _validateInputs(startTime, endTime, eventMode, recurringConfig) {
    if (!startTime || !endTime) throw new Error('startTime and endTime are required');
    if (!eventMode) throw new Error('eventMode is required (live, upcoming, or recurring)');

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid date format for startTime or endTime');
    if (end <= start) throw new Error('endTime must be after startTime');

    const validModes = ['live', 'upcoming', 'recurring'];
    if (!validModes.includes(eventMode)) throw new Error('eventMode must be live, upcoming, or recurring');
    if (eventMode === 'recurring' && !recurringConfig) throw new Error('recurringConfig is required when eventMode is recurring');
  }

  static _emptyResponse(start, end, eventMode) {
    const msg = 'No active rooms found in the system.';
    return {
      success: true,
      message: msg,
      data: {
        requestedPeriod: { start, end },
        eventMode,
        totalRooms: 0, availableCount: 0, unavailableCount: 0,
        availableRooms: [], unavailableRooms: [],
        summary: msg,
      },
    };
  }

  static async _processAllRooms(rooms, start, end, eventMode, recurringConfig, excludeEventId = null) {
    const availableRooms = [];
    const unavailableRooms = [];

    for (const room of rooms) {
      if (eventMode === 'recurring' && recurringConfig) {
        const result = await this._checkRecurringRoomAvailability(room.roomName, start, end, recurringConfig, excludeEventId);
        const item = { room: this._formatRoom(room), available: result.available, message: result.message };
        if (result.available) {
          availableRooms.push(item);
        } else {
          unavailableRooms.push({ ...item, conflicts: result.conflicts, availableDates: result.availableDates, unavailableDates: result.unavailableDates });
        }
      } else {
        const result = await this._checkSingleRoomAvailability(room.roomName, start, end, excludeEventId);
        const item = { room: this._formatRoom(room), available: result.available, message: result.available ? `Room "${room.roomName}" is available for ${start.toLocaleString()} - ${end.toLocaleString()}.` : result.message };
        if (result.available) {
          availableRooms.push(item);
        } else {
          unavailableRooms.push({ ...item, conflicts: result.conflicts });
        }
      }
    }

    return { availableRooms, unavailableRooms };
  }

  /**
   * Returns true when two absolute time ranges overlap (touching edges do not count as overlap).
   */
  static _rangesOverlap(aStart, aEnd, bStart, bEnd) {
    const as = new Date(aStart).getTime();
    const ae = new Date(aEnd).getTime();
    const bs = new Date(bStart).getTime();
    const be = new Date(bEnd).getTime();
    return as < be && ae > bs;
  }

  /**
   * Fetch every conflicting event for a room across the ENTIRE requested window exactly once.
   * Returns in-memory arrays so per-occurrence checks can run without extra DB round-trips.
   * Completed (Past) events are intentionally excluded because they no longer occupy the room.
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
    // When editing a recurring event, exclude both the parent and all generated instances
    // (generated instances use "<parentId>_<timestamp>" ids).
    if (excludeRecurringPrefix) {
      recurringQuery.eventSpecialId = { $not: { $regex: `^${excludeRecurringPrefix}` } };
    } else if (excludeEventId) {
      recurringQuery.eventSpecialId = { $ne: excludeEventId };
    }

    const [live, upcoming, recurring, booking] = await Promise.all([
      LiveEvent.find({ eventRoom: roomName, ...excludeFilter, $or: [{ startedAt: { $lt: end }, willEndAt: { $gt: start } }] }).lean(),
      UpcomingEvent.find({ eventRoom: roomName, ...excludeFilter, $or: [{ willStartAt: { $lt: end }, willEndAt: { $gt: start } }] }).lean(),
      RecurringEvent.find(recurringQuery).lean(),
      BookingRequest.find({
        eventRoom: roomName,
        status: { $in: ['Pending', 'Accepted'] },
        $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
      }).lean(),
    ]);

    return { live, upcoming, recurring, booking };
  }

  /**
   * Build conflict descriptors from in-memory event arrays for a single [start, end] window.
   */
  static _conflictsFromEvents(events, start, end) {
    const conflicts = [];

    for (const lc of events.live) {
      if (this._rangesOverlap(lc.startedAt, lc.willEndAt, start, end)) {
        conflicts.push({ type: 'LiveEvent', eventName: lc.eventName, eventSpecialId: lc.eventSpecialId, startTime: lc.startedAt, endTime: lc.willEndAt, organizer: lc.eventOrganizer?.fullNames || 'N/A' });
      }
    }

    for (const uc of events.upcoming) {
      if (this._rangesOverlap(uc.willStartAt, uc.willEndAt, start, end)) {
        conflicts.push({ type: 'UpcomingEvent', eventName: uc.eventName, eventSpecialId: uc.eventSpecialId, startTime: uc.willStartAt, endTime: uc.willEndAt, organizer: uc.eventOrganizer?.fullNames || 'N/A' });
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
          recurringType: re.eventRecurring.recurringType,
          organizer: re.eventOrganizer?.fullNames || 'N/A',
          message: `Recurring "${re.eventName}" (${re.eventRecurring.recurringType}) overlaps.`,
        });
      }
    }

    for (const br of events.booking) {
      if (this._rangesOverlap(br.startTime, br.endTime, start, end)) {
        conflicts.push({
          type: 'BookingRequest',
          eventName: br.eventName,
          eventSpecialId: br.trackingCode,
          startTime: br.startTime,
          endTime: br.endTime,
          organizer: br.eventOrganizer?.fullNames || 'N/A',
          message: `Booking request "${br.eventName}" (${br.status}) overlaps.`,
        });
      }
    }

    return conflicts;
  }

  static async _checkSingleRoomAvailability(roomName, start, end, excludeEventId = null) {
    const events = await this._fetchRoomEvents(roomName, start, end, excludeEventId);
    const conflicts = this._conflictsFromEvents(events, start, end);

    if (conflicts.length === 0) return { available: true };

    const conflictNames = conflicts.map(c => `"${c.eventName}" (${c.type})`).join(', ');
    return {
      available: false,
      message: `Room "${roomName}" has ${conflicts.length} conflicting event(s): ${conflictNames}.`,
      conflicts,
    };
  }

  static async _checkRecurringRoomAvailability(roomName, eventStartDate, eventEndDate, recurringConfig, excludeEventId = null) {
    const { recurringType, weeklyDays, monthlyDates, monthlyPattern, eventStartTime, eventEndTime, recurringEndDate } = recurringConfig;

    if (!eventStartTime || !eventEndTime) throw new Error('eventStartTime and eventEndTime are required for recurring availability checks');
    if (!recurringEndDate) throw new Error('recurringEndDate is required for recurring availability checks');

    // Monthly patterns that depend on explicit dates must provide them. Without
    // dates we would generate zero occurrences and falsely report every room as
    // unavailable — fail loudly instead.
    if (recurringType === 'Monthly' && (!monthlyPattern || monthlyPattern === 'specific' || monthlyPattern === 'mixed')) {
      if (!Array.isArray(monthlyDates) || monthlyDates.length === 0) {
        throw new Error(`monthlyDates is required for monthly pattern "${monthlyPattern || 'specific'}"`);
      }
    }
    if (recurringType === 'Weekly' && (!Array.isArray(weeklyDays) || weeklyDays.length === 0)) {
      throw new Error('weeklyDays is required for Weekly recurring availability checks');
    }

    const [startHour, startMin] = eventStartTime.split(':').map(Number);
    const [endHour, endMin] = eventEndTime.split(':').map(Number);
    const recurrenceEnd = new Date(recurringEndDate);
    const effectiveEnd = recurrenceEnd < eventEndDate ? recurrenceEnd : eventEndDate;

    const occurrenceDates = recurrenceHelper.generateOccurrenceDates(eventStartDate, effectiveEnd, recurringType, weeklyDays, monthlyDates, monthlyPattern);

    if (occurrenceDates.length === 0) throw new Error('No occurrence dates generated within the requested period. Please provide a complete recurring configuration.');

    // Fetch the room's events ONCE for the whole effective window, then evaluate each
    // occurrence in memory. This avoids firing DB queries for every single occurrence.
    const windowStart = new Date(eventStartDate);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(effectiveEnd);
    windowEnd.setHours(23, 59, 59, 999);
    const events = await this._fetchRoomEvents(roomName, windowStart, windowEnd, excludeEventId, excludeEventId || null);

    const availableDates = [];
    const unavailableDates = [];
    const allConflicts = [];

    for (const occDate of occurrenceDates) {
      const occStart = new Date(occDate);
      occStart.setHours(startHour, startMin, 0, 0);
      const occEnd = new Date(occDate);
      occEnd.setHours(endHour, endMin, 0, 0);

      if (endHour < startHour || (endHour === startHour && endMin <= startMin)) {
        occEnd.setDate(occEnd.getDate() + 1);
      }

      const dayConflicts = this._conflictsFromEvents(events, occStart, occEnd);

      if (dayConflicts.length === 0) {
        availableDates.push({ date: occDate, startTime: occStart.toISOString(), endTime: occEnd.toISOString() });
      } else {
        unavailableDates.push({ date: occDate, startTime: occStart.toISOString(), endTime: occEnd.toISOString(), conflicts: dayConflicts });
        for (const dc of dayConflicts) {
          if (!allConflicts.some(c => c.eventSpecialId === dc.eventSpecialId)) allConflicts.push(dc);
        }
      }
    }

    if (unavailableDates.length === 0) {
      return {
        available: true,
        message: `Room "${roomName}" is available for all ${occurrenceDates.length} occurrence(s) (${occurrenceDates[0].toLocaleDateString()} to ${occurrenceDates[occurrenceDates.length - 1].toLocaleDateString()}).`,
      };
    }

    const availCount = availableDates.length;
    const unavailCount = unavailableDates.length;
    let message = `Room "${roomName}" has partial availability: ${availCount}/${occurrenceDates.length} occurrences available.`;
    if (unavailCount > 0) {
      const names = [...new Set(unavailableDates.flatMap(d => d.conflicts.map(c => `"${c.eventName}"`)))];
      message += ` Conflicts with: ${names.join(', ')}.`;
    }

    // A recurring schedule can only be hosted if EVERY occurrence is free.
    return { available: unavailableDates.length === 0, message, conflicts: allConflicts, availableDates, unavailableDates };
  }

  static _formatRoom(room) {
    return { _id: room._id, roomName: room.roomName, roomDescription: room.roomDescription, roomCapacity: room.roomCapacity, roomLocation: room.roomLocation, isActive: room.isActive };
  }

  static _buildSummary(availableRooms, unavailableRooms, start, end, eventMode, recurringConfig) {
    const total = availableRooms.length + unavailableRooms.length;
    const avail = availableRooms.length;
    const unavail = unavailableRooms.length;

    if (avail === total) {
      if (eventMode === 'recurring' && recurringConfig) {
        return `All ${total} active room(s) are fully available for the recurring schedule${recurringConfig.recurringType ? ` (${recurringConfig.recurringType}, ${recurringConfig.eventStartTime} - ${recurringConfig.eventEndTime})` : ''}.`;
      }
      return `All ${total} active room(s) are available for ${start.toLocaleString()} - ${end.toLocaleString()}.`;
    }

    if (avail > 0 && unavail > 0) {
      if (eventMode === 'recurring' && recurringConfig) {
        return `Partial availability: ${avail}/${total} room(s) can accommodate the recurring schedule. ${unavail} room(s) have conflicts on some or all dates.`;
      }
      return `Partial availability: ${avail}/${total} room(s) available for ${start.toLocaleString()} - ${end.toLocaleString()}. ${unavail} room(s) have conflicts.`;
    }

    if (eventMode === 'recurring' && recurringConfig) {
      return `None of the ${total} active room(s) can fully accommodate the recurring schedule. All rooms have conflicts on some or all dates.`;
    }
    return `None of the ${total} active room(s) are available for ${start.toLocaleString()} - ${end.toLocaleString()}. All rooms have conflicts.`;
  }
}

module.exports = GetAvailableRooms;
