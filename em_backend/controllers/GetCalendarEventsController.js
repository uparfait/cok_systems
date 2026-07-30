const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');
const recurrenceHelper = require('../utilities/recurrenceHelper');

function transformEvent(event, status, startTime, endTime, isCancelled = false) {
  return {
    _id: event._id,
    eventSpecialId: event.eventSpecialId,
    eventName: event.eventName,
    eventDescription: event.eventDescription,
    eventType: event.eventType,
    eventRoom: event.eventRoom,
    eventOrganizer: event.eventOrganizer,
    expectedAudience: event.expectedAudience,
    eventMeetingType: event.eventMeetingType || 'event',
    eventStatus: status,
    startTime,
    endTime,
    isCancelled,
    sourceCollection: status === 'live' ? 'LiveEvent' : status === 'upcoming' ? 'UpcomingEvent' : status === 'recurring' ? 'RecurringEvent' : 'PastEvent'
  };
}

function expandEventToDays(event, status, eventStart, eventEnd, monthStart, monthEnd, isCancelled = false) {
  const results = [];
  const start = new Date(eventStart);
  const end = new Date(eventEnd);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return results;

  const current = new Date(start);
  while (current <= end && current <= monthEnd) {
    if (current >= monthStart) {
      const isFirstDay = current.toISOString().split('T')[0] === start.toISOString().split('T')[0];
      const isLastDay = current.toISOString().split('T')[0] === end.toISOString().split('T')[0];

      let dayStart, dayEnd;
      if (isFirstDay && isLastDay) {
        dayStart = new Date(start);
        dayEnd = new Date(end);
      } else if (isFirstDay) {
        dayStart = new Date(start);
        dayEnd = new Date(current);
        dayEnd.setUTCHours(23, 59, 59, 999);
      } else if (isLastDay) {
        dayStart = new Date(current);
        dayStart.setUTCHours(0, 0, 0, 0);
        dayEnd = new Date(end);
      } else {
        dayStart = new Date(current);
        dayStart.setUTCHours(0, 0, 0, 0);
        dayEnd = new Date(current);
        dayEnd.setUTCHours(23, 59, 59, 999);
      }

      results.push(transformEvent(event, status, dayStart.toISOString(), dayEnd.toISOString(), isCancelled));
    }
    current.setDate(current.getDate() + 1);
  }

  return results;
}

function localDateKey(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRecurringOccurrences(event, monthStart, monthEnd) {
  if (!event.eventRecurring) return [];
  const { recurringType, weeklyDays, monthlyDates, monthlyPattern, eventStartTime, eventEndTime } = event.eventRecurring;
  if (!eventStartTime || !eventEndTime) return [];

  const occurrences = [];
  const [startHour, startMin] = eventStartTime.split(':').map(Number);
  const [endHour, endMin] = eventEndTime.split(':').map(Number);

  // RecurringEvent has NO top-level eventStartDate field — the schedule effectively
  // starts when the event was created (fall back to "now"). Using a missing field
  // produced an Invalid Date and silently yielded zero occurrences.
  const startSource = event.eventStartDate || event.createdAt || new Date();
  const overallStart = new Date(Math.max(new Date(startSource).getTime(), monthStart.getTime()));
  overallStart.setHours(0, 0, 0, 0);
  const recurringEnd = event.eventRecurring.recurringEndDate ? new Date(event.eventRecurring.recurringEndDate) : null;
  const overallEnd = new Date(Math.min(recurringEnd ? recurringEnd.getTime() : monthEnd.getTime(), monthEnd.getTime()));
  overallEnd.setHours(23, 59, 59, 999);

  const current = new Date(overallStart);
  while (current <= overallEnd) {
    let matches = false;
    switch (recurringType) {
      case 'Daily':
        matches = true;
        break;
      case 'Weekly':
        if (weeklyDays && weeklyDays.includes(current.getDay())) {
          matches = true;
        }
        break;
      case 'Monthly':
        matches = recurrenceHelper.isMonthlyDateMatch(current, monthlyPattern, monthlyDates);
        break;
    }

    if (matches) {
      const startDateTime = new Date(current);
      startDateTime.setHours(startHour, startMin, 0, 0);

      let endDateTime = new Date(current);
      endDateTime.setHours(endHour, endMin, 0, 0);
      if (endHour < startHour || (endHour === startHour && endMin <= startMin)) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      if (startDateTime < monthEnd && endDateTime > monthStart) {
        occurrences.push({
          date: new Date(current).toISOString(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString()
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return occurrences;
}

class GetCalendarEventsController {
  static async handle(req, res) {
    try {
      const { month } = req.query;
      const targetDate = month ? new Date(month) : new Date();

      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth();
      const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const isPastMonth = monthStart < currentMonthStart;

      const events = [];

      const [liveEvents, upcomingEvents, recurringEvents, pastEvents] = await Promise.all([
        LiveEvent.find({
          $or: [
            { startedAt: { $lte: monthEnd }, willEndAt: { $gte: monthStart } }
          ]
        }).lean(),
        isPastMonth ? Promise.resolve([]) : UpcomingEvent.find({
          $or: [
            { willStartAt: { $lte: monthEnd }, willEndAt: { $gte: monthStart } }
          ]
        }).lean(),
        isPastMonth ? Promise.resolve([]) : RecurringEvent.find({ 'eventRecurring.isExpired': false }).lean(),
        isPastMonth ? PastEvent.find({
          startedAt: { $lte: monthEnd },
          endedAt: { $gte: monthStart },
          isCancelled: { $ne: true }
        }).lean() : Promise.resolve([])
      ]);

      for (const event of liveEvents) {
        const expanded = expandEventToDays(event, 'live', event.startedAt, event.willEndAt, monthStart, monthEnd);
        events.push(...expanded);
      }

      for (const event of upcomingEvents) {
        const expanded = expandEventToDays(event, 'upcoming', event.willStartAt, event.willEndAt, monthStart, monthEnd);
        events.push(...expanded);
      }

      for (const event of recurringEvents) {
        // MonitorEvents already generates concrete UpcomingEvent/LiveEvent instances
        // for each future occurrence (eventSpecialId = "<parent>_<timestamp>"). Skip any
        // expanded recurring occurrence whose day is already represented by one of those
        // generated instances, otherwise the same event would appear twice on the calendar.
        const [genUpcoming, genLive] = await Promise.all([
          UpcomingEvent.find({ eventSpecialId: { $regex: `^${event.eventSpecialId}_` } }).lean(),
          LiveEvent.find({ eventSpecialId: { $regex: `^${event.eventSpecialId}_` } }).lean(),
        ]);
        const coveredDates = new Set();
        for (const g of [...genUpcoming, ...genLive]) {
          const start = g.willStartAt || g.startedAt;
          const key = localDateKey(start);
          if (key) coveredDates.add(key);
        }

        const occurrences = getRecurringOccurrences(event, monthStart, monthEnd);
        for (const occ of occurrences) {
          if (coveredDates.has(localDateKey(occ.date))) continue;
          events.push({
            ...transformEvent(event, 'recurring', occ.startTime, occ.endTime),
            occurrenceDate: occ.date
          });
        }
      }

      for (const event of pastEvents) {
        const expanded = expandEventToDays(event, 'past', event.startedAt, event.endedAt, monthStart, monthEnd, event.isCancelled);
        events.push(...expanded);
      }

      events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      return res.status(200).json({
        success: true,
        totalRecords: events.length,
        data: events
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving calendar events',
        error: error.message
      });
    }
  }
}

module.exports = GetCalendarEventsController;
