const mongoose = require('mongoose');

/**
 * One audit row per HTTP response that was NOT a plain success (every
 * status except 200 and 201), captured by the response-audit middleware of
 * each backend (main backend, dc_backend, em_backend) and stored in this
 * shared collection of the main "cok" database. Nothing else writes here.
 */
const audit_schema = new mongoose.Schema({
    time: { type: Date, default: Date.now, index: true },
    status: { type: Number, required: true, index: true },
    method: { type: String },
    user_id: { type: String, index: true },
    user_email: { type: String, index: true },
    user_name: { type: String },
    description: { type: String },
    message: { type: String },
    error: { type: String },
    endpoint: { type: String },
    ip_address: { type: String },
    source: { type: String, default: 'backend' },
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

module.exports = mongoose.model('Audit', audit_schema);
