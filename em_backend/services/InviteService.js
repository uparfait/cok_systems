const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const InvitedPeople = require('../models/InvitedPeople');
const UpcomingEvent = require('../models/UpcomingEvent');
const LiveEvent = require('../models/LiveEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');
const emailUtil = require('../utilities/email');
const { firstRecurringOccurrence, fromUTCInstant } = require('../utilities/eventCalendar');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class InviteService {
  /**
   * Parse a file buffer and extract valid emails
   * Supports: CSV, TXT, Excel (.xlsx, .xls)
   */
  static parseFile(buffer, mimetype) {
    const emails = [];

    try {
      // Excel files
      if (mimetype.includes('spreadsheet') || mimetype.includes('excel') ||
          mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          mimetype === 'application/vnd.ms-excel') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) return emails;
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log('Parsed Excel data:', jsonData);
        for (const row of jsonData) {
          for (const cell of row) {
            if (cell && typeof cell === 'string') {
              const found = cell.match(/[^\s@]+@[^\s@]+\.[^\s@]+/gi);
              if (found) emails.push(...found);
            }
          }
        }
      } else {
        // CSV or TXT - read as text
        const content = buffer.toString('utf-8');
        // Split by common delimiters: newlines, commas, semicolons, tabs, spaces
        const parts = content.split(/[\r\n,;\t]+/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed) {
            const found = trimmed.match(/[^\s@]+@[^\s@]+\.[^\s@]+/gi);
            if (found) emails.push(...found);
          }
        }
      }
    } catch (err) {
      throw new Error(`Failed to parse file: ${err.message}`, { cause: err });
    }

    // Normalize and deduplicate
    const normalized = emails.map(e => e.trim().toLowerCase()).filter(e => EMAIL_REGEX.test(e));
    return [...new Set(normalized)];
  }

  /**
   * Parse manually entered emails from a comma/space-separated string
   */
  static parseManualEmails(input) {
    if (!input || typeof input !== 'string') return [];
    // Split by comma, semicolon, or whitespace
    const parts = input.split(/[,;\s]+/);
    const emails = parts.map(p => p.trim().toLowerCase()).filter(e => e && EMAIL_REGEX.test(e));
    return [...new Set(emails)];
  }

  /**
   * Resolve an event by its special ID across the phase collections and return a
   * normalized shape consumable by the calendar/email utilities.
   * Returns null when the event does not exist.
   */
  static async fetchEventForInvite(eventSpecialId) {
    const id = eventSpecialId.toLowerCase().trim();
    const [upcoming, live, recurring, past] = await Promise.all([
      UpcomingEvent.findOne({ eventSpecialId: id }).lean(),
      LiveEvent.findOne({ eventSpecialId: id }).lean(),
      RecurringEvent.findOne({ eventSpecialId: id }).lean(),
      PastEvent.findOne({ eventSpecialId: id }).lean(),
    ]);

    const doc = upcoming || live || recurring || past;
    if (!doc) return null;

    if (recurring) {
      const occ = firstRecurringOccurrence(recurring.eventRecurring);
      return {
        eventName: recurring.eventName,
        eventDescription: recurring.eventDescription,
        eventRoom: recurring.eventRoom,
        eventOrganizer: recurring.eventOrganizer,
        start: occ.start,
        end: occ.end,
        isRecurring: true,
        recurring: recurring.eventRecurring,
      };
    }

    const start = upcoming ? upcoming.willStartAt : live ? live.startedAt : past.startedAt;
    const end = upcoming ? upcoming.willEndAt : live ? live.willEndAt : past.expectedToEndAt;

    return {
      eventName: doc.eventName,
      eventDescription: doc.eventDescription,
      eventRoom: doc.eventRoom,
      eventOrganizer: doc.eventOrganizer,
      start: fromUTCInstant(start),
      end: fromUTCInstant(end),
      isRecurring: false,
      recurring: null,
    };
  }

  /**
   * Invite people to an event. Checks for duplicates before saving, then sends a
   * personalized calendar invitation (.ics) to every newly invited email.
   * Returns stats about what was invited, already existed, or failed to email.
   */
  static async invitePeoples(eventSpecialId, emails) {
    if (!eventSpecialId) throw new Error('Event special ID is required');
    if (!emails || emails.length === 0) throw new Error('No valid emails provided');

    const normalizedEventId = eventSpecialId.toLowerCase().trim();
    const validEmails = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(e => EMAIL_REGEX.test(e)))];

    if (validEmails.length === 0) {
      return {
        totalProvided: emails.length,
        validEmails: 0,
        alreadyInvited: 0,
        newlyInvited: 0,
        invalidEmails: emails.length,
        emailsSent: 0,
        emailErrors: [],
        invited: [],
      };
    }

    // Find which emails are already invited
    const existing = await InvitedPeople.find({
      eventSpecialId: normalizedEventId,
      email: { $in: validEmails },
    }).lean();

    const existingEmails = new Set(existing.map(e => e.email));
    const newEmails = validEmails.filter(e => !existingEmails.has(e));

    const emailsSent = [];
    const emailErrors = [];

    // Bulk insert new invites, each with a stable invitation UID
    if (newEmails.length > 0) {
      const docs = newEmails.map(email => ({
        eventSpecialId: normalizedEventId,
        email,
        invitationUid: uuidv4(),
        invitedAt: new Date(),
      }));
      await InvitedPeople.insertMany(docs, { ordered: false });

      // Send a calendar invitation to each new attendee
      const event = await this.fetchEventForInvite(normalizedEventId);
      if (event) {
        const results = await Promise.allSettled(
          docs.map(d => emailUtil.sendEventInvitation(d.email, event, d.invitationUid))
        );
        results.forEach((result, i) => {
          const ok = result.status === 'fulfilled' && result.value && result.value.success;
          if (ok) {
            emailsSent.push(docs[i].email);
          } else {
            emailErrors.push({
              email: docs[i].email,
              error: (result.reason && result.reason.message) || (result.value && result.value.error) || 'Email send failed',
            });
          }
        });
      }
    }

    return {
      totalProvided: emails.length,
      validEmails: validEmails.length,
      alreadyInvited: existingEmails.size,
      newlyInvited: newEmails.length,
      invalidEmails: emails.length - validEmails.length,
      emailsSent: emailsSent.length,
      emailErrors,
      invited: validEmails,
    };
  }

  /**
   * Get all invited people for an event
   */
  static async getInvitedPeoples(eventSpecialId, page = 1, limit = 50) {
    const normalizedEventId = eventSpecialId.toLowerCase().trim();
    const query = { eventSpecialId: normalizedEventId };

    const totalRecords = await InvitedPeople.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limit);

    const data = await InvitedPeople.find(query)
      .sort({ invitedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      success: true,
      totalRecords,
      totalPages,
      currentPage: page,
      data: data.map(d => ({
        _id: d._id,
        email: d.email,
        invitedAt: d.invitedAt,
        cancelled: d.cancelled || false,
        specificDate: d.specificDate || null,
      })),
    };
  }

  /**
   * Copy a recurring series' invites onto a generated instance. The instance keeps
   * the same invitationUid as the series so a later per-instance cancellation can be
   * correlated, and stores the occurrence's start/end in `specificDate`. No emails are
   * sent because the original series invitation already covers the attendee.
   * @returns {number} number of invite docs created
   */
  static async copyInvitesToInstance(parentEventSpecialId, instanceEventSpecialId, specificDate) {
    const parentId = parentEventSpecialId.toLowerCase().trim();
    const instanceId = instanceEventSpecialId.toLowerCase().trim();

    const parentInvites = await InvitedPeople.find({ eventSpecialId: parentId }).lean();
    if (parentInvites.length === 0) return 0;

    // Avoid duplicates if the instance was already processed
    const existing = await InvitedPeople.find({ eventSpecialId: instanceId }).lean();
    const existingEmails = new Set(existing.map((e) => e.email));

    const docs = parentInvites
      .filter((inv) => !existingEmails.has(inv.email))
      .map((inv) => ({
        eventSpecialId: instanceId,
        email: inv.email,
        invitationUid: inv.invitationUid, // same UID => cancels correlate to the series
        specificDate: { start: specificDate.start, end: specificDate.end },
        invitedAt: new Date(),
      }));

    if (docs.length > 0) {
      await InvitedPeople.insertMany(docs, { ordered: false });
    }
    return docs.length;
  }

  /**
   * Remove/cancel an invited person by ID.
   * - If the invite has a `specificDate` (a single occurrence of a series), it is NOT
   *   deleted. We send a per-occurrence METHOD:CANCEL (RECURRENCE-ID) and flag it
   *   `cancelled` so the UI can show the state and allow re-activation later.
   * - Otherwise (series parent or single event) the doc is deleted and a full cancel
   *   (or single-event cancel) is sent.
   */
  static async removeInvitedPerson(inviteId) {
    const invite = await InvitedPeople.findById(inviteId);
    if (!invite) throw new Error('Invited person not found');

    if (invite.invitationUid) {
      const event = await this.fetchEventForInvite(invite.eventSpecialId);
      if (event) {
        if (invite.specificDate && invite.specificDate.start) {
          const specificEvent = {
            eventName: event.eventName,
            eventDescription: event.eventDescription,
            eventRoom: event.eventRoom,
            eventOrganizer: event.eventOrganizer,
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
          invite.cancelled = true;
          invite.cancelledAt = new Date();
          await invite.save();
          return { success: true, message: 'Invitation for this date cancelled', cancelled: true };
        }
        await emailUtil.sendEventCancellation(invite.email, event, invite.invitationUid);
      }
    }

    await InvitedPeople.findByIdAndDelete(inviteId);
    return { success: true, message: 'Invitation removed successfully' };
  }

  /**
   * Re-activate a previously cancelled invite (typically a specific-date instance).
   * Un-flags `cancelled` and re-sends the invitation. For a series occurrence this
   * sends a METHOD:REQUEST with RECURRENCE-ID so the client re-adds that date.
   */
  static async reactivateInvitedPerson(inviteId) {
    const invite = await InvitedPeople.findById(inviteId);
    if (!invite) throw new Error('Invited person not found');
    if (!invite.cancelled) {
      return { success: true, message: 'Invitation is already active', alreadyActive: true };
    }

    const event = await this.fetchEventForInvite(invite.eventSpecialId);
    if (event && invite.invitationUid) {
      if (invite.specificDate && invite.specificDate.start) {
        const specificEvent = {
          eventName: event.eventName,
          eventDescription: event.eventDescription,
          eventRoom: event.eventRoom,
          eventOrganizer: event.eventOrganizer,
          start: invite.specificDate.start,
          end: invite.specificDate.end,
          isRecurring: false,
          recurring: null,
        };
        await emailUtil.sendEventInvitation(
          invite.email,
          specificEvent,
          invite.invitationUid,
          invite.specificDate.start
        );
      } else {
        await emailUtil.sendEventInvitation(invite.email, event, invite.invitationUid);
      }
    }

    invite.cancelled = false;
    invite.cancelledAt = null;
    await invite.save();
    return { success: true, message: 'Invitation re-activated successfully' };
  }
}

module.exports = InviteService;
