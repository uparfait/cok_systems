const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  attendeeFullName: {
    type: String,
    required: [true, 'Your fullName is required'],
    maxlength: [700, 'Name cannot exceed 200 characters'],
    trim: true
  },
  attendeeEmail: {
    type: String,
    required: false,
    maxlength: [300, 'Email cannot exceed 300 characters'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    unique: false
  },
  eventSpecialId: {
    type: String,
    required: [true, 'Event special ID is required']
  },
  attendeePhoneNumber: {
    type: String,
    required: [true, 'Your phone number is required'],
    trim: true
  },
  attendeeInstitution: { 
    type: String,
    required: [true, 'Your Institution is required'],
    trim: true
  },
  attendeePosition: {
    type: String,
    required: [true, 'Your Position is required'],
    trim: true
  },
  attendanceTime: {
    type: Date,
    default: Date.now
  },
  attendeeSignature: {
    type: String, // drawn signature as "data:image/png;base64,..." — optional
    required: false,
    maxlength: [200000, 'Signature image too large']
  },
  digitalCertificate: {
    type: String, // uploaded digital certificate file URL — optional
    required: false,
    maxlength: [1000, 'Certificate URL too large']
  },
  signatureMethod: {
    type: String,
    enum: ['draw', 'certificate'],
    default: null,
  },
  eventName: {
    type: String,
    required: false,
    trim: true,
  },
  eventRoom: {
    type: String,
    required: false,
    trim: true,
  },
  roomLocation: {
    type: String,
    required: false,
    trim: true,
  },
}, { timestamps: true });

attendanceSchema.index({ attendanceTime: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance; 