const mongoose = require('mongoose');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');

/**
 * Service to handle event cancellation.
 * Cancelled events are moved to PastEvent collection with isCancelled=true.
 */
class CancelEventService {
  /**
   * Cancel an event by its MongoDB _id and event type.
   * @param {string} eventId - MongoDB _id of the event
   * @param {string} eventType - 'live', 'upcoming', or 'recurring'
   * @param {string} reason - Optional cancellation reason
   * @returns {Promise<object>} - The created PastEvent document
   */
  static async execute(eventId, eventType, reason = '') {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let pastEventData;

      switch (eventType) {
        case 'live':
          pastEventData = await this._cancelLiveEvent(eventId, reason, session);
          break;
        case 'upcoming':
          pastEventData = await this._cancelUpcomingEvent(eventId, reason, session);
          break;
        case 'recurring':
          pastEventData = await this._cancelRecurringEvent(eventId, reason, session);
          break;
        default:
          throw new Error('Invalid event type. Must be live, upcoming, or recurring.');
      }

      await session.commitTransaction();
      return { success: true, data: pastEventData };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async _cancelLiveEvent(eventId, reason, session) {
    const liveEvent = await LiveEvent.findById(eventId).session(session);
    if (!liveEvent) {
      throw new Error('Live event not found');
    }

    const pastEvent = new PastEvent({
      eventMeetingType: liveEvent.eventMeetingType || 'event',
      eventName: liveEvent.eventName,
      eventDescription: liveEvent.eventDescription,
      eventType: liveEvent.eventType,
      eventRoom: liveEvent.eventRoom,
      eventOrganizer: liveEvent.eventOrganizer,
      eventSpecialId: `${liveEvent.eventSpecialId}_cancelled_${Date.now()}`,
      startedAt: liveEvent.startedAt,
      expectedToEndAt: liveEvent.willEndAt,
      endedAt: new Date(),
      isCancelled: true,
      cancellationReason: reason,
      expectedAudience: liveEvent.expectedAudience,
      activityAgenda: liveEvent.activityAgenda || [],
    });

    await pastEvent.save({ session });
    await LiveEvent.findByIdAndDelete(eventId, { session });

    return pastEvent;
  }

  static async _cancelUpcomingEvent(eventId, reason, session) {
    const upcomingEvent = await UpcomingEvent.findById(eventId).session(session);
    if (!upcomingEvent) {
      throw new Error('Upcoming event not found');
    }

    const pastEvent = new PastEvent({
      eventMeetingType: upcomingEvent.eventMeetingType || 'event',
      eventName: upcomingEvent.eventName,
      eventDescription: upcomingEvent.eventDescription,
      eventType: upcomingEvent.eventType,
      eventRoom: upcomingEvent.eventRoom,
      eventOrganizer: upcomingEvent.eventOrganizer,
      eventSpecialId: `${upcomingEvent.eventSpecialId}_cancelled_${Date.now()}`,
      startedAt: upcomingEvent.willStartAt,
      expectedToEndAt: upcomingEvent.willEndAt,
      endedAt: new Date(),
      isCancelled: true,
      cancellationReason: reason,
      expectedAudience: upcomingEvent.expectedAudience,
      activityAgenda: upcomingEvent.activityAgenda || [],
    });

    await pastEvent.save({ session });
    await UpcomingEvent.findByIdAndDelete(eventId, { session });

    return pastEvent;
  }

  static async _cancelRecurringEvent(eventId, reason, session) {
    const recurringEvent = await RecurringEvent.findById(eventId).session(session);
    if (!recurringEvent) {
      throw new Error('Recurring event not found');
    }

    // Mark recurring event as expired
    recurringEvent.eventRecurring.isExpired = true;
    if (reason) {
      recurringEvent.eventRecurring.willExpire = true;
      recurringEvent.eventRecurring.willExpireAt = new Date();
    }
   

    // Create a cancellation record in PastEvent
    const pastEvent = new PastEvent({
      eventMeetingType: recurringEvent.eventMeetingType || 'event',
      eventName: recurringEvent.eventName,
      eventDescription: recurringEvent.eventDescription,
      eventType: recurringEvent.eventType,
      eventRoom: recurringEvent.eventRoom,
      eventOrganizer: recurringEvent.eventOrganizer,
      eventSpecialId: `${recurringEvent.eventSpecialId}_cancelled_${Date.now()}`,
      startedAt: recurringEvent.eventStartTime || new Date(),
      expectedToEndAt: recurringEvent.eventRecurring.recurringEndDate,
      endedAt: recurringEvent.eventEndTime || new Date(),
      isCancelled: true,
      cancellationReason: reason,
      expectedAudience: recurringEvent.expectedAudience,
      activityAgenda: recurringEvent.activityAgenda || [],
    });

    await pastEvent.save({ session });

    
    await recurringEvent.deleteOne({ session });

    // Also cancel any upcoming occurrences of this recurring event
    await UpcomingEvent.deleteMany(
      { eventSpecialId: { $regex: `^${recurringEvent.eventSpecialId}` } },
      { session }
    );

    return pastEvent;
  }
}

module.exports = CancelEventService;