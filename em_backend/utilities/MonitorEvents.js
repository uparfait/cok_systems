const withTransaction = require('./withTransaction');
const RecurringEvent = require('../models/RecurringEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const LiveEvent = require('../models/LiveEvent');
const InvitedPeople = require('../models/InvitedPeople');
const EventService = require('../services/EventService');
const InviteService = require('../services/InviteService');
const CheckRoomAvailability = require('./CheckRoomAvailability');

class MonitorEvents {
  static async execute() {
    try {
      await withTransaction(async (session) => {
        await this.processRecurringEvents(session);
        await this.processUpcomingEvents(session);
        await this.processLiveEvents(session);
        await this.processRecurringExpirations(session);
      });
      console.log('Event monitoring completed successfully');
    } catch (error) {
      console.error('Event monitoring failed:', error);
      throw error;
    }
  }

  static async processRecurringEvents(session) {
    const now = new Date();
    
    const recurringEvents = await RecurringEvent.find({
      'eventRecurring.isExpired': false,
      'eventRecurring.recurringEndDate': { $gte: now }
    }).session(session);

   

    for (const recurring of recurringEvents) {
      const nextOccurrence = this.getNextOccurrence(recurring, now);

    
      
      
      if (nextOccurrence) {
        const { start, end } = nextOccurrence;

        // Check if this occurrence already exists in UpcomingEvents.
        // Generated instances use eventSpecialId = `${parent}_${start.getTime()}`,
        // so we must match the exact generated id — not the parent id — or the
        // monitor would re-insert it every cycle and hit a duplicate-key error.
        const generatedEventSpecialId = `${recurring.eventSpecialId}_${start.getTime()}`;
        const existingUpcoming = await UpcomingEvent.findOne({
          eventSpecialId: generatedEventSpecialId
        }).session(session);

        

      

        if (!existingUpcoming) {
          // Check room availability - exclude this recurring event AND all its generated instances
          const availability = await CheckRoomAvailability.execute(
            recurring.eventRoom,
            start,
            end,
            null,                     // no exact eventSpecialId to exclude
            recurring.eventSpecialId  // exclude ALL events whose ID starts with this prefix
          );

          if (availability.available) {
            // Create upcoming event for this occurrence
            const upcomingEvent = new UpcomingEvent({
              eventMeetingType: recurring.eventMeetingType || "event",
              eventName: recurring.eventName,
              eventDescription: recurring.eventDescription,
              eventType: recurring.eventType,
              eventRoom: recurring.eventRoom,
              eventOrganizer: recurring.eventOrganizer,
              eventSpecialId: `${recurring.eventSpecialId}_${start.getTime()}`,
              expectedAudience: recurring.expectedAudience,
              willStartAt: start,
              willEndAt: end
            });

            await upcomingEvent.save({ session });
            console.log(`Created upcoming event for recurring event ${recurring.eventSpecialId} at ${start}`);

            // Track invites: copy the series' invites onto this instance so a later
            // removal cancels just this date. Reuses the series UID (no email sent).
            try {
              const copied = await InviteService.copyInvitesToInstance(
                recurring.eventSpecialId,
                upcomingEvent.eventSpecialId,
                { start: upcomingEvent.willStartAt, end: upcomingEvent.willEndAt }
              );
              if (copied > 0) {
                console.log(`Copied ${copied} invite(s) to instance ${upcomingEvent.eventSpecialId}`);
              }
            } catch (err) {
              console.error(`copyInvitesToInstance failed for ${upcomingEvent.eventSpecialId}:`, err.message);
            }
          } else {
            console.log(`Room not available for recurring event ${recurring.eventName} ${recurring.eventSpecialId} at ${start}. Conflict: ${availability.conflict}`);
          }
        }
      }
    }
  }

  static getNextOccurrence(recurringEvent, referenceDate) {
    const { recurringType, weeklyDays, monthlyDates, monthlyPattern, eventStartTime, eventEndTime } = recurringEvent.eventRecurring;
    const endDate = new Date(recurringEvent.eventRecurring.recurringEndDate);
    
    const [startHour, startMin] = eventStartTime.split(':').map(Number);
    const [endHour, endMin] = eventEndTime.split(':').map(Number);

    let currentDate = new Date(referenceDate);
    
    // Create a tracking date for "today's" event instance to see if it already passed
    const todayEventTime = new Date(currentDate);
    todayEventTime.setHours(startHour, startMin, 0, 0);

    // If the reference time is already PAST today's event execution time, 
    // start checking from tomorrow. Otherwise, check starting TODAY.
    if (currentDate >= todayEventTime) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    while (currentDate <= endDate) {
      let start, end;
      let isMatch = false;

      switch (recurringType) {
        case 'Daily':
          isMatch = true;
          break;

        case 'Weekly':
          if (weeklyDays && weeklyDays.includes(currentDate.getDay())) {
            isMatch = true;
          }
          break;

        case 'Monthly':
          if (this.isMonthlyOccurrence(currentDate, monthlyPattern, monthlyDates)) {
            isMatch = true;
          }
          break;
      }

      if (isMatch) {
        start = new Date(currentDate);
        start.setHours(startHour, startMin, 0, 0);
        
        end = new Date(currentDate);
        end.setHours(endHour, endMin, 0, 0);
        
        // Handle case where end time is on next day (e.g., 23:00 to 02:00)
        if (endHour < startHour || (endHour === startHour && endMin <= startMin)) {
          end.setDate(end.getDate() + 1);
        }
        
        return { start, end };
      }

      // Safely iterate to the next day if no match was found
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return null; // Return null if no occurrence is found before the endDate expires
  }

  static isMonthlyOccurrence(date, monthlyPattern, monthlyDates) {
    const dayOfMonth = date.getDate();
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    
    switch (monthlyPattern) {
      case 'specific':
        return monthlyDates && monthlyDates.includes(dayOfMonth);
      
      case 'firstDay':
        return dayOfMonth === 1;
      
      case 'lastDay':
        return dayOfMonth === lastDayOfMonth;
      
      case 'firstTwoWeeks':
        return dayOfMonth >= 1 && dayOfMonth <= 14;
      
      case 'lastTwoWeeks':
        return dayOfMonth >= (lastDayOfMonth - 13) && dayOfMonth <= lastDayOfMonth;
      
      case 'mixed':
        // For mixed, check specific dates if provided
        return monthlyDates && monthlyDates.includes(dayOfMonth);
      
      default:
        return false;
    }
  }

  static async processUpcomingEvents(session) {
    const now = new Date();
    
    const upcomingEvents = await UpcomingEvent.find({
      willStartAt: { $lte: now }
    }).session(session);

    for (const event of upcomingEvents) {
      await EventService.moveUpcomingToLive(event._id, session);
    }
  }

  static async processLiveEvents(session) {
    const now = new Date();
    
    const liveEvents = await LiveEvent.find({
      willEndAt: { $lte: now }
    }).session(session);

    for (const event of liveEvents) {
      await EventService.moveLiveToPast(event._id, session);
    }
  }

  static async processRecurringExpirations(session) {
    const now = new Date();
    
    await RecurringEvent.updateMany(
      {
        'eventRecurring.willExpire': true,
        'eventRecurring.willExpireAt': { $lte: now },
        'eventRecurring.isExpired': false
      },
      {
        $set: { 'eventRecurring.isExpired': true }
      },
      { session }
    );
  }

  /**
   * Safety net: ensure every generated instance (Upcoming AND Live) of an active
   * recurring event has its series invites copied. Catches any instance that was
   * created (or whose invites were skipped) before the copy logic ran, so no
   * attendee is ever left without their invite. Copying is idempotent (deduped by
   * email + instance id) and never resurrects a cancelled specific-date invite.
   */
  static async reconcileRecurringInvites(session) {
    const recurringEvents = await RecurringEvent.find({
      'eventRecurring.isExpired': false,
      'eventRecurring.recurringEndDate': { $gte: new Date() },
    }).session(session);

    for (const recurring of recurringEvents) {
      const parentInvites = await InvitedPeople.find({
        eventSpecialId: recurring.eventSpecialId,
      }).lean();
      if (parentInvites.length === 0) continue;

      // Instance ids are `${parent}_${ms}`; match all of them.
      const escaped = recurring.eventSpecialId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}_`);

      const [upcomingInstances, liveInstances] = await Promise.all([
        UpcomingEvent.find({ eventSpecialId: { $regex: regex } }).session(session).lean(),
        LiveEvent.find({ eventSpecialId: { $regex: regex } }).session(session).lean(),
      ]);

      for (const inst of [...upcomingInstances, ...liveInstances]) {
        const specificDate = inst.willStartAt
          ? { start: inst.willStartAt, end: inst.willEndAt }
          : { start: inst.startedAt, end: inst.willEndAt };

        try {
          const copied = await InviteService.copyInvitesToInstance(
            recurring.eventSpecialId,
            inst.eventSpecialId,
            specificDate
          );
          if (copied > 0) {
            console.log(
              `[reconcile] Caught missing invites for recurring ${recurring.eventSpecialId}: ` +
              `copied ${copied} to instance ${inst.eventSpecialId}`
            );
          }
        } catch (err) {
          console.error(`[reconcile] Failed copying invites to ${inst.eventSpecialId}:`, err.message);
        }
      }
    }
  }
}

module.exports = MonitorEvents;