const mongoose = require('mongoose');

const recurringSubSchema = new mongoose.Schema({
  isRecurring: {
    type: Boolean,
    required: true,
    default: true
  },
  recurringType: {
    type: String,
    enum: {
      values: ['Daily', 'Weekly', 'Monthly'],
      message: 'Recurring type must be Daily, Weekly, or Monthly'
    },
    required: [true, 'Recurring type is required for recurring events']
  },
  recurringEndDate: {
    type: Date,
    required: [true, 'Recurring end date is required for recurring events'],
    validate: {
      validator: function(value) {
        if (this.isRecurring && value <= new Date()) {
          return false;
        }
        return true;
      },
      message: 'Recurring end date must be in the future'
    }
  },
  // Universal time fields for all recurring types
  eventStartTime: {
    type: String,
    required: [true, 'Event start time is required for recurring events'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format (00:00-23:59)']
  },
  eventEndTime: {
    type: String,
    required: [true, 'Event end time is required for recurring events'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format (00:00-23:59)'],
    validate: {
      validator: function(value) {
        if (this.eventStartTime) {
          return value > this.eventStartTime;
        }
        return true;
      },
      message: 'End time must be after start time'
    }
  },
  weeklyDays: {
    type: [Number],
    validate: {
      validator: function(value) {
        if (this.recurringType === 'Weekly') {
          if (!value || value.length === 0) {
            return false;
          }
          return value.every(day => day >= 0 && day <= 6);
        }
        return true;
      },
      message: 'Weekly recurring requires at least one day (0-6, Sunday-Saturday)'
    }
  },
  monthlyDates: {
    type: [Number],
    validate: {
      validator: function(value) {
        if (this.recurringType === 'Monthly') {
          if (!value || value.length === 0) {
            return false;
          }
          return value.every(date => date >= 1 && date <= 31);
        }
        return true;
      },
      message: 'Monthly recurring requires valid dates (1-31)'
    }
  },
  monthlyPattern: {
    type: String,
    enum: {
      values: ['specific', 'firstDay', 'lastDay', 'firstTwoWeeks', 'lastTwoWeeks', 'mixed'],
      message: 'Invalid monthly pattern'
    },
    default: 'specific'
  },
  willExpire: {
    type: Boolean,
    required: true,
    default: false
  },
  willExpireAt: {
    type: Date,
    required: function() {
      return this.willExpire === true;
    },
    validate: {
      validator: function(value) {
        if (this.willExpire && value) {
          return value > new Date();
        }
        return true;
      },
      message: 'Expiry date must be in the future'
    }
  },
  isExpired: {
    type: Boolean,
    default: false
  }
}, { _id: false });

module.exports = recurringSubSchema;