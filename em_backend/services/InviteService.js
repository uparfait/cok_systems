const XLSX = require('xlsx');
const InvitedPeople = require('../models/InvitedPeople');

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
   * Invite people to an event. Checks for duplicates before saving.
   * Returns stats about what was invited, already existed, or was invalid.
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

    // Bulk insert new invites
    if (newEmails.length > 0) {
      const docs = newEmails.map(email => ({
        eventSpecialId: normalizedEventId,
        email,
        invitedAt: new Date(),
      }));
      await InvitedPeople.insertMany(docs, { ordered: false });
    }

    return {
      totalProvided: emails.length,
      validEmails: validEmails.length,
      alreadyInvited: existingEmails.size,
      newlyInvited: newEmails.length,
      invalidEmails: emails.length - validEmails.length,
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
      })),
    };
  }

  /**
   * Remove an invited person by ID
   */
  static async removeInvitedPerson(inviteId) {
    const result = await InvitedPeople.findByIdAndDelete(inviteId);
    if (!result) throw new Error('Invited person not found');
    return { success: true, message: 'Invitation removed successfully' };
  }
}

module.exports = InviteService;