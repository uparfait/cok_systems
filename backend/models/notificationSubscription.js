const mongoose = require('mongoose');

const notificationSubscriptionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  endpoint: {
    type: String,
    required: true
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  user_agent: {
    type: String,
    default: ''
  },
  user_info: {
    full_name: { type: String, required: true },
    email: { type: String, required: true },
    telephone: { type: String, default: '' },
    role: { type: String, required: true },
    department: { type: String, default: '' },
    department_id: { type: String, default: '' }
  },
  is_active: {
    type: Boolean,
    default: true
  },
  subscribed_at: {
    type: Date,
    default: Date.now
  },
  last_notification_at: {
    type: Date,
    default: null
  }
}, {
  versionKey: false,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('NotificationSubscription', notificationSubscriptionSchema);
