const mongoose = require('mongoose');

const invitedPeopleSchema = new mongoose.Schema({
  eventSpecialId: {
    type: String,
    required: [true, 'Event special ID is required'],
    index: true,
    trim: true,
    lowercase: true,
  },
  // Unique iCalendar UID (stored so we can issue a METHOD:CANCEL later)
  invitationUid: {
    type: String,
    required: [true, 'Invitation UID is required'],
    index: true,
  },
  // Present only for invites copied from a recurring series onto a specific
  // generated instance. Holds that occurrence's start/end so a removal cancels
  // just this date (via RECURRENCE-ID) instead of the whole series.
  specificDate: {
    start: { type: Date },
    end: { type: Date },
  },
  // When a specific-date invite is cancelled we keep the doc (so the UI can show
  // the cancelled state and allow re-activation) and just flag it here.
  cancelled: {
    type: Boolean,
    default: false,
  },
  cancelledAt: {
    type: Date,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
  },
  invitedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

// Prevent duplicate invites for the same event
invitedPeopleSchema.index({ eventSpecialId: 1, email: 1 }, { unique: true });

const InvitedPeople = mongoose.model('InvitedPeople', invitedPeopleSchema);

module.exports = InvitedPeople;