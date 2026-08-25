/**
 * After an event's schedule changes (inline schedule edit or postpone), re-send
 * the calendar invitation to every non-cancelled invitee with the SAME iCal UID
 * and a bumped SEQUENCE, so Google Calendar / Outlook replace the previously
 * saved entry with the new time instead of creating a duplicate.
 *
 * Email failures are logged per-invitee and never abort the flow.
 */

const InvitedPeople = require('../models/InvitedPeople');
const emailUtil = require('./email');

/**
 * @param {string} originalEventSpecialId - The eventSpecialId invitees were stored
 *   under (postponing a live event mints a new id, so pass the original).
 * @param {object} eventForEmail - Normalized event: { eventName, eventDescription,
 *   eventRoom, eventOrganizer, start, end, isRecurring, recurring }
 */
async function notifyInviteesOfScheduleChange(originalEventSpecialId, eventForEmail) {
  const invites = await InvitedPeople.find({
    eventSpecialId: originalEventSpecialId,
    cancelled: { $ne: true },
  });

  for (const invite of invites) {
    try {
      const sequence = (invite.sequence || 0) + 1;
      // Occurrence-specific copies (a single date of a recurring series) are
      // updated per-occurrence: same series UID plus RECURRENCE-ID, so the
      // calendar client replaces just that instance, not the whole series.
      const recurrenceId = invite.specificDate && invite.specificDate.start
        ? invite.specificDate.start
        : null;
      const result = await emailUtil.sendEventUpdate(
        invite.email,
        eventForEmail,
        invite.invitationUid,
        sequence,
        recurrenceId
      );
      if (result.success) {
        invite.sequence = sequence;
        await invite.save();
      }
    } catch (err) {
      console.error(`Failed to send schedule update to ${invite.email}:`, err.message);
    }
  }
}

/**
 * After a non-schedule change (name, description, organizer, agenda, or
 * location), send every non-cancelled invitee a PLAIN email only. No calendar
 * attachment is sent and the iCal SEQUENCE is not bumped, so the entry in
 * their calendar stays untouched.
 */
async function notifyInviteesOfDetailsChange(originalEventSpecialId, eventForEmail) {
  const invites = await InvitedPeople.find({
    eventSpecialId: originalEventSpecialId,
    cancelled: { $ne: true },
  }).lean();

  for (const invite of invites) {
    try {
      await emailUtil.sendEventDetailsUpdate(invite.email, eventForEmail);
    } catch (err) {
      console.error(`Failed to send details update to ${invite.email}:`, err.message);
    }
  }
}

module.exports = { notifyInviteesOfScheduleChange, notifyInviteesOfDetailsChange };
