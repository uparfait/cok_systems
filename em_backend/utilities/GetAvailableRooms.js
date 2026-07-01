const Room = require('../models/Room');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
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

  static async _checkSingleRoomAvailability(roomName, start, end, excludeEventId = null) {
    const conflicts = await this._findConflicts(roomName, start, end, excludeEventId);

    if (conflicts.length === 0) return { available: true };

    const conflictNames = conflicts.map(c => `"${c.eventName}" (${c.type})`).join(', ');
    return {
      available: false,
      message: `Room "${roomName}" has ${conflicts.length} conflicting event(s): ${conflictNames}.`,
      conflicts,
    };
  }

  static async _findConflicts(roomName, start, end, excludeEventId = null, excludeRecurringPrefix = null) {
    const conflicts = [];

    const excludeFilter = excludeEventId ? { eventSpecialId: { $ne: excludeEventId } } : {};

    const combinedExclude = { ...excludeFilter };
    if (excludeRecurringPrefix) {
      combinedExclude.eventSpecialId = { ...combinedExclude.eventSpecialId, $not: { $regex: `^${excludeRecurringPrefix}` } };
    }

    const [liveConflicts, upcomingConflicts, recurringEvents] = await Promise.all([
      LiveEvent.find({ eventRoom: roomName, ...combinedExclude, $or: [{ startedAt: { $lt: end }, willEndAt: { $gt: start } }] }).lean(),
      UpcomingEvent.find({ eventRoom: roomName, ...combinedExclude, $or: [{ willStartAt: { $lt: end }, willEndAt: { $gt: start } }] }).lean(),
      RecurringEvent.find({ eventRoom: roomName, ...excludeFilter, 'eventRecurring.recurringEndDate': { $gte: start }, 'eventRecurring.isExpired': false }).lean(),
    ]);

    for (const lc of liveConflicts) {
      conflicts.push({ type: 'LiveEvent', eventName: lc.eventName, eventSpecialId: lc.eventSpecialId, startTime: lc.startedAt, endTime: lc.willEndAt, organizer: lc.eventOrganizer?.fullNames || 'N/A' });
    }

    for (const uc of upcomingConflicts) {
      conflicts.push({ type: 'UpcomingEvent', eventName: uc.eventName, eventSpecialId: uc.eventSpecialId, startTime: uc.willStartAt, endTime: uc.willEndAt, organizer: uc.eventOrganizer?.fullNames || 'N/A' });
    }

    for (const re of recurringEvents) {
      if (recurrenceHelper.isRecurringOverlapping(re, start, end)) {
        conflicts.push({ type: 'RecurringEvent', eventName: re.eventName, eventSpecialId: re.eventSpecialId, startTime: re.eventRecurring.eventStartTime, endTime: re.eventRecurring.eventEndTime, recurringType: re.eventRecurring.recurringType, organizer: re.eventOrganizer?.fullNames || 'N/A', message: `Recurring "${re.eventName}" (${re.eventRecurring.recurringType}) overlaps.` });
      }
    }

    return conflicts;
  }

  static async _checkRecurringRoomAvailability(roomName, eventStartDate, eventEndDate, recurringConfig, excludeEventId = null) {
    const { recurringType, weeklyDays, monthlyDates, monthlyPattern, eventStartTime, eventEndTime, recurringEndDate } = recurringConfig;

    if (!eventStartTime || !eventEndTime) return this._invalidRecurringConfig('eventStartTime and eventEndTime');
    if (!recurringEndDate) return this._invalidRecurringConfig('recurringEndDate');

    const [startHour, startMin] = eventStartTime.split(':').map(Number);
    const [endHour, endMin] = eventEndTime.split(':').map(Number);
    const recurrenceEnd = new Date(recurringEndDate);
    const effectiveEnd = recurrenceEnd < eventEndDate ? recurrenceEnd : eventEndDate;

    const occurrenceDates = recurrenceHelper.generateOccurrenceDates(eventStartDate, effectiveEnd, recurringType, weeklyDays, monthlyDates, monthlyPattern);

    if (occurrenceDates.length === 0) return { available: false, message: 'No occurrence dates generated within the requested period.', conflicts: [], availableDates: [], unavailableDates: [] };

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

      const dayConflicts = await this._findConflicts(roomName, occStart, occEnd, excludeEventId);

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

    return { available: availCount > 0, message, conflicts: allConflicts, availableDates, unavailableDates };
  }

  static _invalidRecurringConfig(fields) {
    return { available: false, message: `Recurring configuration must include ${fields}.`, conflicts: [], availableDates: [], unavailableDates: [] };
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