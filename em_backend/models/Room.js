const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomName: {
    type: String,
    required: [true, 'Room name is required'],
    maxlength: [300, 'Room name cannot exceed 300 characters'],
    trim: true,
    set: value => value.toLowerCase()
  },
  roomDescription: {
    type: String,
    required: [true, 'Room description is required'],
    maxlength: [1000, 'Room description cannot exceed 1000 characters'],
    trim: true
  },
  roomCapacity: {
    type: Number,
    required: [true, 'Room capacity is required'],
    min: [1, 'Room capacity must be at least 1']
  },
  roomLocation: {
    type: String,
    required: [true, 'Room location is required'],
    maxlength: [500, 'Room location cannot exceed 500 characters'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Case-insensitive unique index
roomSchema.index({ roomName: 1 }, { 
  unique: true,
  collation: { locale: 'en', strength: 2 }
});
roomSchema.index({ roomLocation: 1 });
roomSchema.index({ isActive: 1 });

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;