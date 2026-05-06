const mongoose = require('mongoose');

const audit_schema = new mongoose.Schema({
    action: { type: String, required: true, enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ERROR', 'SYSTEM'] },
    time: { type: Date, default: Date.now },
    description: { type: String, required: true },
    user_id: { type: String },
    user_name: { type: String }, // Populated from user data
    user_email: { type: String }, // Populated from user data
    resource: { type: String }, // What resource was affected (users, vehicles, visitors, etc.)
    resource_id: { type: String }, // ID of the affected resource
    ip_address: { type: String }, // Client IP address
    user_agent: { type: String }, // Browser/device info
    method: { type: String }, // HTTP method (GET, POST, PUT, DELETE)
    endpoint: { type: String }, // API endpoint accessed
    status_code: { type: Number }, // HTTP response status
    old_values: { type: mongoose.Schema.Types.Mixed }, // For updates - what changed from
    new_values: { type: mongoose.Schema.Types.Mixed }, // For updates - what changed to
    error_message: { type: String }, // For error logs
    metadata: { type: mongoose.Schema.Types.Mixed } // Additional data
},{
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

module.exports = mongoose.model('Audit', audit_schema);