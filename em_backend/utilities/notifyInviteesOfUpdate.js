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
    // Occurrence-specific copies carry their own dates - skip them here; the
    // monitor regenerates instances (and their invites) from the parent series.
    if (invite.specificDate && invite.specificDate.start) continue;

    try {
      const sequence = (invite.sequence || 0) + 1;
      const result = await emailUtil.sendEventUpdate(
        invite.email,
        eventForEmail,
        invite.invitationUid,
        sequence
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

module.exports = { notifyInviteesOfScheduleChange };
