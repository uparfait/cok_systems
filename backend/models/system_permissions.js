const mongoose = require('mongoose');

const system_permission_schema = new mongoose.Schema({
    resource: { type: String, required: true },
    actions: [
        {
            action_type: {
                type: String,
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'REALTIME'], // restrict to standard HTTP verbs
                required: true
            },
            description: { type: String, default: 'No description provided' }
        }
    ],
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, {
    versionKey: false, // removes __v automatically
    toJSON: {
        transform: function (doc, ret) {
            delete ret.__v; // just in case
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

// Middleware to auto-update `updated_at`
system_permission_schema.pre('save', function (next) {
    this.updated_at = new Date();
    next();
});

module.exports = mongoose.model('SystemPermission', system_permission_schema);
