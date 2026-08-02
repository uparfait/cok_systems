const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // task is only required for task-related notification types
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    type: {
        type: String,
        enum: ['deadline_reminder', 'task_completed', 'subtask_completed', 'negative_feedback', 'announcement', 'task_assigned'],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    isEmailSent: { type: Boolean, default: false },
    scheduledFor: { type: Date }, // When to send the notification
    createdAt: { type: Date, default: Date.now }
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

// Index for performance
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);