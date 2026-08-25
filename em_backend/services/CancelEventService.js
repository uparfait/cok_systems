const withTransaction = require('../utilities/withTransaction');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');
const InvitedPeople = require('../models/InvitedPeople');
const BookRequestModel = require('../models/BookingRequest');
const emailUtil = require('../utilities/email');
const { firstRecurringOccurrence, fromUTCInstant } = require('../utilities/eventCalendar');

class CancelEventService {
  static async execute(eventId, eventType, reason = '') {
    return withTransaction(async (session) => {
      let pastEventData;
      let originalEventSpecialId;

      switch (eventType) {
        case 'live':
          ({ pastEventData, originalEventSpecialId } = await this._cancelLiveEvent(eventId, reason, session));
          break;
        case 'upcoming':
          ({ pastEventData, originalEventSpecialId } = await this._cancelUpcomingEvent(eventId, reason, session));
          break;
        case 'recurring':
          ({ pastEventData, originalEventSpecialId } = await this._cancelRecurringEvent(eventId, reason, session));
          break;
        default:
          throw new Error('Invalid event type. Must be live, upcoming, or recurring.');
      }

      if (originalEventSpecialId && pastEventData) {
        try {
          await this._sendCancellationEmails(originalEventSpecialId, pastEventData, eventType);
        } catch (emailError) {
          console.error('Failed to send some cancellation emails:', emailError.message);
        }
      }

      return { success: true, data: pastEventData };
    });
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
      eventFormat: liveEvent.eventFormat || 'Physical',
      virtualLink: liveEvent.virtualLink || '',
      virtualDescription: liveEvent.virtualDescription || '',
      eventOrganizer: liveEvent.eventOrganizer,
      coOrganizers: liveEvent.coOrganizers || [],
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

    const bookingRequest = await BookRequestModel.findOne({ acceptedEventSpecialId: liveEvent.eventSpecialId }).session(session);
    if (bookingRequest) {
      bookingRequest.status = 'Cancelled';
      bookingRequest.cancellationReason = reason;
      await bookingRequest.save({ session });
    }

    return { pastEventData: pastEvent.toObject(), originalEventSpecialId: liveEvent.eventSpecialId };
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
      eventFormat: upcomingEvent.eventFormat || 'Physical',
      virtualLink: upcomingEvent.virtualLink || '',
      virtualDescription: upcomingEvent.virtualDescription || '',
      eventOrganizer: upcomingEvent.eventOrganizer,
      coOrganizers: upcomingEvent.coOrganizers || [],
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

    const bookingRequest = await BookRequestModel.findOne({ acceptedEventSpecialId: upcomingEvent.eventSpecialId }).session(session);
    if (bookingRequest) {
      bookingRequest.status = 'Cancelled';
      bookingRequest.cancellationReason = reason;
      await bookingRequest.save({ session });
    }

    return { pastEventData: pastEvent.toObject(), originalEventSpecialId: upcomingEvent.eventSpecialId };
  }

  static async _cancelRecurringEvent(eventId, reason, session) {
    const recurringEvent = await RecurringEvent.findById(eventId).session(session);
    if (!recurringEvent) {
      throw new Error('Recurring event not found');
    }

    const eventData = {
      eventName: recurringEvent.eventName,
      eventDescription: recurringEvent.eventDescription,
      eventRoom: recurringEvent.eventRoom,
      eventFormat: recurringEvent.eventFormat || 'Physical',
      virtualLink: recurringEvent.virtualLink || '',
      virtualDescription: recurringEvent.virtualDescription || '',
      eventOrganizer: recurringEvent.eventOrganizer,
      eventRecurring: recurringEvent.eventRecurring,
    };

    await recurringEvent.deleteOne({ session });

    await UpcomingEvent.deleteMany(
      { eventSpecialId: { $regex: `^${recurringEvent.eventSpecialId}` } },
      { session }
    );

    return { pastEventData: eventData, originalEventSpecialId: recurringEvent.eventSpecialId };
  }

  static async _sendCancellationEmails(originalEventSpecialId, eventData, eventType) {
    const invites = await InvitedPeople.find({ eventSpecialId: originalEventSpecialId });
    if (invites.length === 0) return;

    let eventForEmail;

    if (eventType === 'recurring') {
      const occ = firstRecurringOccurrence(eventData.eventRecurring);
      eventForEmail = {
        eventName: eventData.eventName,
        eventDescription: eventData.eventDescription || '',
        eventRoom: eventData.eventRoom,
        eventFormat: eventData.eventFormat || 'Physical',
        virtualLink: eventData.virtualLink || '',
        virtualDescription: eventData.virtualDescription || '',
        eventOrganizer: eventData.eventOrganizer,
        start: occ.start,
        end: occ.end,
        isRecurring: true,
        recurring: eventData.eventRecurring,
      };
    } else {
      eventForEmail = {
        eventName: eventData.eventName,
        eventDescription: eventData.eventDescription || '',
        eventRoom: eventData.eventRoom,
        eventFormat: eventData.eventFormat || 'Physical',
        virtualLink: eventData.virtualLink || '',
        virtualDescription: eventData.virtualDescription || '',
        eventOrganizer: eventData.eventOrganizer,
        start: fromUTCInstant(eventData.startedAt),
        end: fromUTCInstant(eventData.expectedToEndAt),
        isRecurring: false,
        recurring: null,
      };
    }

    for (const invite of invites) {
      try {
        if (invite.specificDate && invite.specificDate.start) {
          const specificEvent = {
            eventName: eventForEmail.eventName,
            eventDescription: eventForEmail.eventDescription,
            eventRoom: eventForEmail.eventRoom,
            eventFormat: eventForEmail.eventFormat,
            virtualLink: eventForEmail.virtualLink,
            virtualDescription: eventForEmail.virtualDescription,
            eventOrganizer: eventForEmail.eventOrganizer,
            start: invite.specificDate.start,
            end: invite.specificDate.end,
            isRecurring: false,
            recurring: null,
          };
          await emailUtil.sendEventCancellation(
            invite.email,
            specificEvent,
            invite.invitationUid,
            invite.specificDate.start
          );
        } else {
          await emailUtil.sendEventCancellation(
            invite.email,
            eventForEmail,
            invite.invitationUid
          );
        }

        if (!invite.cancelled) {
          invite.cancelled = true;
          invite.cancelledAt = new Date();
          await invite.save();
        }
      } catch (err) {
        console.error(`Failed to send cancellation to ${invite.email}:`, err.message);
      }
    }
  }
}

module.exports = CancelEventService;
