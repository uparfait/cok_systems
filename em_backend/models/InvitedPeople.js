const mongoose = require('mongoose');

const invitedPeopleSchema = new mongoose.Schema({
  eventSpecialId: {
    type: String,
    required: [true, 'Event special ID is required'],
    index: true,
    trim: true,
    lowercase: true,
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