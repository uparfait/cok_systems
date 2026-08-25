/**
 * eventCalendar.js
 * Builds RFC-5545 iCalendar (.ics) strings for event invitations and cancellations
 * using `ical-generator`, with a proper IANA timezone.
 */

const ical = require('ical-generator').default;
const tzlib = require('timezones-ical-library');

const [, RAW_TZID] = tzlib.tzlib_get_ical_block('Africa/Kigali');
const TIMEZONE_NAME = RAW_TZID.replace(/^TZID=/, ''); 

const KIGALI_OFFSET_HOURS = 2;

function wallClockDate(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function fromUTCInstant(date) {
  const d = new Date(date);
  return wallClockDate(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours() + KIGALI_OFFSET_HOURS,
    d.getUTCMinutes()
  );
}

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Fixed reminder ladder attached to EVERY invitation regardless of how far
// away the event is (clients simply ignore triggers that are already past).
//
// SIGN CONVENTION (verified against ical-generator output): the `trigger`
// option takes POSITIVE seconds meaning "this long BEFORE the event start"
// and the library serializes the RFC 5545 negative form itself:
//   trigger: 1800    -> TRIGGER:-PT30M      (30 minutes before start)
//   trigger: 2592000 -> TRIGGER:-P30D       (30 days before start)
// Do NOT negate these values: a negative number makes ical-generator emit
// TRIGGER;RELATED=END:PT30M, an alarm AFTER the event ends.
const REMINDER_ALARMS = [
  { seconds: 30 * 24 * 60 * 60, label: '30 days until event' },
  { seconds: 10 * 24 * 60 * 60, label: '10 days until event' },
  { seconds: 5 * 24 * 60 * 60, label: '5 days until event' },
  { seconds: 2 * 24 * 60 * 60, label: '2 days until event' },
  { seconds: 30 * 60, label: '30 minutes until event' },
  { seconds: 5 * 60, label: '5 minutes until event' },
];

// Recurring series alarms fire relative to EVERY occurrence, so long-range
// reminders (30, 10, 5, 2 days) on a daily or weekly series would produce
// overlapping alerts for occurrences far in the future. Series therefore only
// carry the short-range reminders; one-off events keep the full ladder.
const RECURRING_REMINDER_ALARMS = REMINDER_ALARMS.filter((a) => a.seconds <= 30 * 60);

function monthlyMatch(date, pattern, dates) {
  const dayOfMonth = date.getDate();
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  switch (pattern) {
    case 'specific':
    case 'mixed':
      return !!(dates && dates.includes(dayOfMonth));
    case 'firstDay':
      return dayOfMonth === 1;
    case 'lastDay':
      return dayOfMonth === lastDay;
    case 'firstTwoWeeks':
      return dayOfMonth >= 1 && dayOfMonth <= 14;
    case 'lastTwoWeeks':
      return dayOfMonth >= lastDay - 13 && dayOfMonth <= lastDay;
    default:
      return false;
  }
}

function firstRecurringOccurrence(cfg) {
  const [startH, startM] = cfg.eventStartTime.split(':').map(Number);
  const [endH, endM] = cfg.eventEndTime.split(':').map(Number);
  const end = new Date(cfg.recurringEndDate);
  const now = new Date();

  // Guard against empty structures causing excessive looping
  if (cfg.recurringType === 'Weekly' && (!cfg.weeklyDays || cfg.weeklyDays.length === 0)) {
    return { start: now, end: now };
  }

  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let matched = null;

  while (cursor <= end && !matched) {
    let isMatch = false;
    switch (cfg.recurringType) {
      case 'Daily':
        isMatch = true;
        break;
      case 'Weekly':
        isMatch = !!(cfg.weeklyDays && cfg.weeklyDays.includes(cursor.getDay()));
        break;
      case 'Monthly':
        isMatch = monthlyMatch(cursor, cfg.monthlyPattern, cfg.monthlyDates);
        break;
      default:
        break;
    }

    if (isMatch) {
      const candidate = wallClockDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate(), startH, startM);
      if (candidate.getTime() > now.getTime()) matched = new Date(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!matched) matched = cursor;

  const start = wallClockDate(matched.getFullYear(), matched.getMonth() + 1, matched.getDate(), startH, startM);
  const endDateTime = wallClockDate(matched.getFullYear(), matched.getMonth() + 1, matched.getDate(), endH, endM);
  if (endH < startH || (endH === startH && endM <= startM)) {
    endDateTime.setDate(endDateTime.getDate() + 1);
  }

  return { start, end: endDateTime };
}

function applyRecurrence(event, recurring) {
  const until = fromUTCInstant(new Date(recurring.recurringEndDate));

  switch (recurring.recurringType) {
    case 'Daily':
      event.repeating({ freq: 'DAILY', until });
      break;

    case 'Weekly':
      if (recurring.weeklyDays && recurring.weeklyDays.length > 0) {
        event.repeating({
          freq: 'WEEKLY',
          byDay: recurring.weeklyDays.map((d) => WEEKDAY_CODES[d]),
          until,
        });
      }
      break;

    case 'Monthly':
      if (recurring.monthlyPattern === 'firstDay') {
        event.repeating({ freq: 'MONTHLY', byMonthDay: [1], until });
      } else if (recurring.monthlyPattern === 'lastDay') {
        event.repeating({ freq: 'MONTHLY', byMonthDay: [-1], until });
      } else if (
        (recurring.monthlyPattern === 'specific' ||
          recurring.monthlyPattern === 'mixed') &&
        recurring.monthlyDates &&
        recurring.monthlyDates.length > 0
      ) {
        event.repeating({
          freq: 'MONTHLY',
          byMonthDay: recurring.monthlyDates,
          until,
        });
      }
      break;

    default:
      break;
  }
}

/**
 * Build an iCalendar string for an event.
 * @param {object} event - Normalized event
 * @param {string} invitationUid - Stable UID
 * @param {'REQUEST'|'CANCEL'} method
 * @param {string} [attendeeEmail] - Recipient email
 * @param {number} [sequence=0] - Track changes; increment on update/cancel to force update down to clients
 * @param {Date} [recurrenceId] - For cancelling a single occurrence of a series;
 *   emits RECURRENCE-ID so clients remove just that instance, not the whole series.
 */
function buildInviteICS(event, invitationUid, method = 'REQUEST', attendeeEmail = null, sequence = 0, recurrenceId = null) {
  const cal = ical({
    method,
    prodId: { company: 'City of Kigali', product: 'Events', language: 'EN' },
    // ical-generator automatically emits TIMEZONE-ID + X-WR-TIMEZONE from the
    // timezone name below, so a manual `x` block would duplicate the property.
    timezone: {
      name: TIMEZONE_NAME,
      generator: (name) => tzlib.tzlib_get_ical_block(name)[0],
    },
  });

  // Physical events point attendees at the room; virtual events at the meeting
  // link (or its description) so calendar clients show how to join.
  const location = event.eventFormat === 'Virtual'
    ? (event.virtualLink || event.virtualDescription || 'Virtual')
    : (event.eventRoom || '');

  const calendarEvent = cal.createEvent({
    // NOTE: ical-generator v4 ignores the `uid` option and always mints a random
    // id, so we must set `id` for the stored invitationUid to appear as the ICS UID
    // (required so a later METHOD:CANCEL with the same UID can be correlated).
    id: invitationUid,
    start: event.start,
    end: event.end,
    summary: event.eventName || 'Event',
    description: event.eventDescription || '',
    location,
    status: method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED',
    // Cancels must carry SEQUENCE >= the original invite so clients remove it.
    // When upstream DB state isn't supplied yet, default cancel to 1, invite to 0.
    sequence: sequence > 0 ? sequence : method === 'CANCEL' ? 1 : 0,
    timezone: TIMEZONE_NAME,
    // recurrenceId (only for cancelling a single series occurrence) must be undefined
    // (not null) so ical-generator skips it when absent.
    recurrenceId: recurrenceId || undefined,
    stamp: new Date(),
    organizer: {
      name: (event.eventOrganizer && event.eventOrganizer.fullNames) || 'City of Kigali',
      email:
        (event.eventOrganizer && event.eventOrganizer.email) ||
        "coksystems@kigalicity.gov.rw",
    },
  });

  if (attendeeEmail) {
    calendarEvent.createAttendee({
      email: attendeeEmail,
      name: attendeeEmail,
      rsvp: true,
      role: 'REQ-PARTICIPANT',
      status: method === 'CANCEL' ? 'DECLINED' : 'NEEDS-ACTION',
    });
  }

  if (event.isRecurring && event.recurring) {
    applyRecurrence(calendarEvent, event.recurring);
  }

  // Attach the reminder ladder to every invitation/update (not cancels), each
  // alarm naming the event. One-off events get the full ladder (30d, 10d, 5d,
  // 2d, 30m, 5m); recurring series only get the short-range reminders because
  // their alarms repeat relative to every occurrence.
  if (method !== 'CANCEL') {
    const title = event.eventName || 'Event';
    const alarms = event.isRecurring && event.recurring ? RECURRING_REMINDER_ALARMS : REMINDER_ALARMS;
    for (const alarm of alarms) {
      calendarEvent.createAlarm({
        type: 'display',
        trigger: alarm.seconds,
        description: `Reminder: ${title} - ${alarm.label}`,
      });
    }
  }

  let ics = cal.toString();

  // RFC 5545 requires DTSTAMP to be in UTC (trailing Z). ical-generator formats it
  // with the calendar timezone (floating), so force UTC here without affecting the
  // TZID DTSTART/DTEND or the VTIMEZONE block.
  ics = ics.replace(/DTSTAMP:[^\r\n]*/, toUtcStamp());

  return ics;
}

function toUtcStamp(date = new Date()) {
  return 'DTSTAMP:' + date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

module.exports = {
  buildInviteICS,
  firstRecurringOccurrence,
  fromUTCInstant,
  wallClockDate,
  TIMEZONE_NAME,
  monthlyMatch,
};
