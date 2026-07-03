const Room = require('../models/Room');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const BookingRequest = require('../models/BookingRequest');
const recurrenceHelper = require('./recurrenceHelper');

class CheckRoomAvailability {
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
    // Sometimes we need to exclude a specific eventSpecialId (exact match)
    // Other times we need to exclude all events whose IDs START WITH a prefix
    // (e.g., recurring event "REC_123" generates upcoming "REC_123_456")
    let specialIdExclusion = null;
    if (excludeRecurringPrefix) {
      specialIdExclusion = { $regex: `^${excludeRecurringPrefix}` };
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
}

module.exports = CheckRoomAvailability;