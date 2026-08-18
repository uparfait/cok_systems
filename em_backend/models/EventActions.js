const mongoose = require('mongoose');

const eventActionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Action title is required'],
    maxlength: [200, 'Action title cannot exceed 200 characters'],
    trim: true
  },
  actionDescription: {
    type: String,
    required: [true, 'Action description is required'],
    maxlength: [2000, 'Action description cannot exceed 2000 characters'],
    trim: true
  },
  assignedPerson: {
    name: {
      type: String,
      required: [true, 'Assigned person name is required'],
      maxlength: [200, 'Name cannot exceed 200 characters'],
      trim: true
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: [true, 'Assigned person role is required'],
      maxlength: [200, 'Role cannot exceed 200 characters'],
      trim: true
    },
    institution: {
      type: String,
      required: [true, 'Assigned person institution is required'],
      maxlength: [300, 'Institution name cannot exceed 300 characters'],
      trim: true
    }
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  currentStatus: {
    status: {
      type: String,
      required: [true, 'Current status is required'],
      enum: {
        values: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
        message: 'Status must be Pending, In Progress, Completed or Cancelled'
      },
      default: 'Pending'
    },
    description: {
      type: String,
      required: [true, 'Status description is required'],
      maxlength: [1000, 'Status description cannot exceed 1000 characters'],
      trim: true
    }
  },
  statusHistory: [{
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
        message: 'Status must be Pending, In Progress, Completed or Cancelled'
      }
    },
    description: {
      type: String,
      required: [true, 'Status description is required'],
      maxlength: [1000, 'Status description cannot exceed 1000 characters'],
      trim: true
    },
    document: {
      filename:     { type: String },
      originalName: { type: String },
      mimetype:     { type: String },
      size:         { type: Number },
      url:          { type: String },
    },
    documents: [{
      filename:     { type: String },
      originalName: { type: String },
      mimetype:     { type: String },
      size:         { type: Number },
      url:          { type: String },
    }],
    changedBy: {
      name:  { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    name:        { type: String, trim: true, default: 'Administrator' },
    email:       { type: String, trim: true, lowercase: true },
    role:        { type: String, trim: true },
    institution: { type: String, trim: true },
  },
  eventSpecialId: {
    type: String,
    required: [true, 'Event special ID is required']
  }
}, {
  timestamps: true 
});

// Indexes for efficient querying
eventActionSchema.index({ eventSpecialId: 1 });
eventActionSchema.index({ dueDate: 1 });
eventActionSchema.index({ 'currentStatus.status': 1 });
eventActionSchema.index({ 'assignedPerson.name': 1 });

const EventAction = mongoose.model('EventAction', eventActionSchema);

module.exports = EventAction;