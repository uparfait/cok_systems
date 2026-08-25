const withTransaction = require('../utilities/withTransaction');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');
const { fromUTCInstant, firstRecurringOccurrence } = require('../utilities/eventCalendar');
const { notifyInviteesOfScheduleChange } = require('../utilities/notifyInviteesOfUpdate');

const POSTPONE_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance for "now"

class PostponeEventService {
  /**
   * Postpone an event with new date/time values.
   * @param {string} eventId - MongoDB _id of the event
   * @param {string} eventType - 'live', 'upcoming', or 'recurring'
   * @param {object} newSchedule - Object containing new schedule fields
   */
  static async execute(eventId, eventType, newSchedule) {
    return withTransaction(async (session) => {
      let result;

      switch (eventType) {
        case 'live':
          result = await this._postponeLiveEvent(eventId, newSchedule, session);
          break;
        case 'upcoming':
          result = await this._postponeUpcomingEvent(eventId, newSchedule, session);
          break;
        case 'recurring':
          result = await this._postponeRecurringEvent(eventId, newSchedule, session);
          break;
        default:
          throw new Error('Invalid event type. Must be live, upcoming, or recurring.');
      }

      return { success: true, data: result };
    });
  }

  /**
   * Push updated calendar invitations (same UID, bumped SEQUENCE) to everyone
   * invited, so their Google/Outlook calendars follow the postponed schedule.
   * Never throws — email failures must not undo the postponement.
   */
  static async _notifyReschedule(originalEventSpecialId, eventDoc, start, end, recurring = null) {
    try {
      await notifyInviteesOfScheduleChange(originalEventSpecialId, {
        eventName: eventDoc.eventName,
        eventDescription: eventDoc.eventDescription || '',
        eventRoom: eventDoc.eventRoom,
        eventFormat: eventDoc.eventFormat || 'Physical',
        virtualLink: eventDoc.virtualLink || '',
        virtualDescription: eventDoc.virtualDescription || '',
        eventOrganizer: eventDoc.eventOrganizer,
        start,
        end,
        isRecurring: !!recurring,
        recurring,
      });
    } catch (err) {
      console.error('Failed to send postponement calendar updates:', err.message);
    }
  }

  /**
   * Issue 1 FIX: When a live event is postponed to a future start time,
   * it should be MOVED to UpcomingEvent, not kept as LiveEvent.
   */
  static async _postponeLiveEvent(eventId, newSchedule, session) {
    const liveEvent = await LiveEvent.findById(eventId).session(session);
    if (!liveEvent) {
      throw new Error('Live event not found');
    }

    const now = new Date();
    const { startedAt, willEndAt } = newSchedule;

    if (!startedAt && !willEndAt) {
      throw new Error('At least one of startedAt or willEndAt must be provided for postponement.');
    }

    // Determine effective new times
    const effectiveStart = startedAt ? new Date(startedAt) : liveEvent.startedAt;
    const effectiveEnd = willEndAt ? new Date(willEndAt) : liveEvent.willEndAt;

    if (isNaN(effectiveStart.getTime()) || isNaN(effectiveEnd.getTime())) {
      throw new Error('Invalid date format.');
    }

    if (effectiveStart >= effectiveEnd) {
      throw new Error('End time must be after start time.');
    }

    // ISSUE 3 FIX: Allow tolerance of 5 minutes for "now"
    const toleranceNow = new Date(now.getTime() - POSTPONE_TOLERANCE_MS);
    if (effectiveEnd <= toleranceNow) {
      throw new Error('Postponed end time must not be in the past.');
    }

    // Check room availability (exclude self by eventSpecialId; virtual events hold no room)
    if (liveEvent.eventFormat !== 'Virtual') {
      const availability = await CheckRoomAvailability.execute(
        liveEvent.eventRoom,
        effectiveStart,
        effectiveEnd,
        liveEvent.eventSpecialId
      );
      if (!availability.available) {
        throw new Error('Room is already reserved during the postponed time.');
      }
    }

    // ISSUE 1 FIX: If the new start time is in the future (> 5 min from now),
    // move the event from LiveEvent to UpcomingEvent
    if (effectiveStart > toleranceNow) {
      // Create UpcomingEvent from the LiveEvent data with new schedule
      const upcomingEvent = new UpcomingEvent({
        eventMeetingType: liveEvent.eventMeetingType || 'event',
        eventName: liveEvent.eventName,
        eventDescription: liveEvent.eventDescription,
        eventType: liveEvent.eventType,
        eventRoom: liveEvent.eventRoom,
        eventFormat: liveEvent.eventFormat || 'Physical',
        virtualLink: liveEvent.virtualLink || '',
        virtualDescription: liveEvent.virtualDescription || '',
        coOrganizers: liveEvent.coOrganizers || [],
        eventOrganizer: liveEvent.eventOrganizer,
        eventSpecialId: `${liveEvent.eventSpecialId}_postponed_${Date.now()}`,
        expectedAudience: liveEvent.expectedAudience,
        activityAgenda: liveEvent.activityAgenda || [],
        willStartAt: effectiveStart,
        willEndAt: effectiveEnd
      });

      await upcomingEvent.save({ session });
      await LiveEvent.findByIdAndDelete(eventId, { session });

      // Invites are stored under the ORIGINAL eventSpecialId (the migrated copy got a new one)
      await this._notifyReschedule(liveEvent.eventSpecialId, upcomingEvent, fromUTCInstant(effectiveStart), fromUTCInstant(effectiveEnd));

      return upcomingEvent;
    }

    // If start time is "now" or very close, keep as live event (just update times)
    liveEvent.startedAt = effectiveStart;
    liveEvent.willEndAt = effectiveEnd;
    const savedLive = await liveEvent.save({ session });

    await this._notifyReschedule(liveEvent.eventSpecialId, savedLive, fromUTCInstant(effectiveStart), fromUTCInstant(effectiveEnd));

    return savedLive;
  }

  /**
   * ISSUE 3 FIX: Allow postponing upcoming events to "now" (within tolerance).
   * If the new start time has already passed by more than 5 minutes, reject.
   * If the start time is "now" or very close, this effectively means "start now"
   * so we should also move from UpcomingEvent to LiveEvent.
   */
  static async _postponeUpcomingEvent(eventId, newSchedule, session) {
    const upcomingEvent = await UpcomingEvent.findById(eventId).session(session);
    if (!upcomingEvent) {
      throw new Error('Upcoming event not found');
    }

    const now = new Date();
    const { willStartAt, willEndAt } = newSchedule;

    if (!willStartAt && !willEndAt) {
      throw new Error('At least one of willStartAt or willEndAt must be provided for postponement.');
    }

    // Determine effective new times
    const effectiveStart = willStartAt ? new Date(willStartAt) : upcomingEvent.willStartAt;
    const effectiveEnd = willEndAt ? new Date(willEndAt) : upcomingEvent.willEndAt;

    if (isNaN(effectiveStart.getTime()) || isNaN(effectiveEnd.getTime())) {
      throw new Error('Invalid date format.');
    }

    if (effectiveStart >= effectiveEnd) {
      throw new Error('End time must be after start time.');
    }

    // ISSUE 3 FIX: Allow "now" with 5-minute tolerance
    const toleranceNow = new Date(now.getTime() - POSTPONE_TOLERANCE_MS);
    if (effectiveEnd <= toleranceNow) {
      throw new Error('Postponed end time must not be in the past.');
    }

    // Check room availability (exclude self by eventSpecialId; virtual events hold no room)
    if (upcomingEvent.eventFormat !== 'Virtual') {
      const availability = await CheckRoomAvailability.execute(
        upcomingEvent.eventRoom,
        effectiveStart,
        effectiveEnd,
        upcomingEvent.eventSpecialId
      );
      if (!availability.available) {
        throw new Error('Room is already reserved during the postponed time.');
      }
    }

    // If the new start time is "now" or in the very recent past (within 5 min tolerance),
    // the user wants to start the event now -> move from UpcomingEvent to LiveEvent
    if (effectiveStart <= now) {
      const liveEvent = new LiveEvent({
        eventMeetingType: upcomingEvent.eventMeetingType || 'event',
        eventName: upcomingEvent.eventName,
        eventDescription: upcomingEvent.eventDescription,
        eventType: upcomingEvent.eventType,
        eventRoom: upcomingEvent.eventRoom,
        eventFormat: upcomingEvent.eventFormat || 'Physical',
        virtualLink: upcomingEvent.virtualLink || '',
        virtualDescription: upcomingEvent.virtualDescription || '',
        coOrganizers: upcomingEvent.coOrganizers || [],
        eventOrganizer: upcomingEvent.eventOrganizer,
        eventSpecialId: upcomingEvent.eventSpecialId,
        expectedAudience: upcomingEvent.expectedAudience,
        activityAgenda: upcomingEvent.activityAgenda || [],
        startedAt: effectiveStart,
        willEndAt: effectiveEnd
      });

      await liveEvent.save({ session });
      await UpcomingEvent.findByIdAndDelete(eventId, { session });

      await this._notifyReschedule(upcomingEvent.eventSpecialId, liveEvent, fromUTCInstant(effectiveStart), fromUTCInstant(effectiveEnd));

      return liveEvent;
    }

    // Otherwise just update the dates (keep as upcoming)
    upcomingEvent.willStartAt = effectiveStart;
    upcomingEvent.willEndAt = effectiveEnd;
    const savedUpcoming = await upcomingEvent.save({ session });

    await this._notifyReschedule(upcomingEvent.eventSpecialId, savedUpcoming, fromUTCInstant(effectiveStart), fromUTCInstant(effectiveEnd));

    return savedUpcoming;
  }

  static async _postponeRecurringEvent(eventId, newSchedule, session) {
    const recurringEvent = await RecurringEvent.findById(eventId).session(session);
    if (!recurringEvent) {
      throw new Error('Recurring event not found');
    }

    const now = new Date();
    const { eventStartTime, eventEndTime, recurringEndDate } = newSchedule;

    // Validate recurring config hasn't expired
    if (recurringEvent.eventRecurring.isExpired) {
      throw new Error('Cannot postpone an expired recurring event.');
    }

    const recurringUpdates = {};

    if (eventStartTime) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(eventStartTime)) {
        throw new Error('Start time must be in HH:MM format.');
      }
      recurringUpdates.eventStartTime = eventStartTime;
    }

    if (eventEndTime) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(eventEndTime)) {
        throw new Error('End time must be in HH:MM format.');
      }
      recurringUpdates.eventEndTime = eventEndTime;
    }

    if (recurringEndDate) {
      const newEnd = new Date(recurringEndDate);
      if (isNaN(newEnd.getTime())) {
        throw new Error('Invalid recurringEndDate format.');
      }
      // ISSUE 3 FIX: Apply tolerance to recurring end date check too
      const toleranceNow = new Date(now.getTime() - POSTPONE_TOLERANCE_MS);
      if (newEnd <= toleranceNow) {
        throw new Error('Postponed recurring end date must not be in the past.');
      }
      recurringUpdates.recurringEndDate = newEnd;
    }

    // Validate times if both provided
    const effectiveStartTime = recurringUpdates.eventStartTime || recurringEvent.eventRecurring.eventStartTime;
    const effectiveEndTime = recurringUpdates.eventEndTime || recurringEvent.eventRecurring.eventEndTime;
    if (effectiveStartTime >= effectiveEndTime) {
      throw new Error('End time must be after start time.');
    }

    // Apply recurring updates
    if (Object.keys(recurringUpdates).length > 0) {
      Object.assign(recurringEvent.eventRecurring, recurringUpdates);
    }

    // Check room availability for the first future occurrence (virtual events hold no room)
    if (Object.keys(recurringUpdates).length > 0 && recurringEvent.eventFormat !== 'Virtual') {
      const actualStartTime = recurringUpdates.eventStartTime || recurringEvent.eventRecurring.eventStartTime;
      const actualEndTime = recurringUpdates.eventEndTime || recurringEvent.eventRecurring.eventEndTime;
      const [startHour, startMin] = actualStartTime.split(':').map(Number);
      const [endHour, endMin] = actualEndTime.split(':').map(Number);

      const checkDate = new Date(now);
      const startDateTime = new Date(checkDate);
      startDateTime.setHours(startHour, startMin, 0, 0);

      // If the start time today has already passed, check tomorrow
      if (startDateTime <= now) {
        startDateTime.setDate(startDateTime.getDate() + 1);
      }

      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(endHour, endMin, 0, 0);

      if (endHour < startHour || (endHour === startHour && endMin <= startMin)) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      // Check room availability (exclude self by eventSpecialId, AND all its generated instances)
      const availability = await CheckRoomAvailability.execute(
        recurringEvent.eventRoom,
        startDateTime,
        endDateTime,
        null,
        recurringEvent.eventSpecialId  // excludeRecurringPrefix
      );

      if (!availability.available) {
        throw new Error('Room is already reserved during the postponed time.');
      }
    }

    // Also clean up any previously generated upcoming instances for this recurring event
    // since they now have the wrong times
    await UpcomingEvent.deleteMany(
      { eventSpecialId: { $regex: `^${recurringEvent.eventSpecialId}_` } },
      { session }
    );

    const savedRecurring = await recurringEvent.save({ session });

    if (Object.keys(recurringUpdates).length > 0) {
      const occ = firstRecurringOccurrence(savedRecurring.eventRecurring);
      await this._notifyReschedule(
        savedRecurring.eventSpecialId,
        savedRecurring,
        occ.start,
        occ.end,
        savedRecurring.eventRecurring
      );
    }

    return savedRecurring;
  }
}

module.exports = PostponeEventService;