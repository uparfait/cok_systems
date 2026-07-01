const mongoose = require('mongoose');

const postMeetingSchema = new mongoose.Schema({
  meetingMinutes: {
    type: String,
    required: [true, 'Meeting minutes are required'],
    trim: false,
    validate: {
      validator: function(value) {
        return value.trim().length > 0;
      },
      message: 'Meeting minutes cannot be empty'
    }
  },
  documentedBy: {
    name: {
      type: String,
      required: [true, 'Documenter name is required'],
      maxlength: [200, 'Name cannot exceed 200 characters'],
      trim: true
    },
    role: {
      type: String,
      required: [true, 'Documenter role is required'],
      maxlength: [200, 'Role cannot exceed 200 characters'],
      trim: true
    },
    institution: {
      type: String,
      required: [true, 'Documenter institution is required'],
      maxlength: [300, 'Institution name cannot exceed 300 characters'],
      trim: true
    },
    email: {type: String},
    phone: {type: String}
  },
  meetingDate: {
    type: Date,
    required: [true, 'Meeting date is required'],
    default: Date.now
  },
  eventSpecialId: {
    type: String,
    required: [true, 'Event special ID is required']
  }
}, { 
  timestamps: true 
});

// Indexes for efficient querying
postMeetingSchema.index({ eventSpecialId: 1 });
postMeetingSchema.index({ meetingDate: -1 });
postMeetingSchema.index({ 'documentedBy.name': 1 });
postMeetingSchema.index({ 'decisions.decidedBy.name': 1 });

const PostMeeting = mongoose.model('PostMeeting', postMeetingSchema);

module.exports = PostMeeting;