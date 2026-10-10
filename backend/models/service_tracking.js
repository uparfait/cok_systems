const mongoose = require('mongoose');

// One row per finished service (completed, transferred or force-completed).
const service_tracking_schema = new mongoose.Schema({
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', default: null, index: true },
    service_delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceDelivery', default: null, index: true },
    department_id: String,
    department_name: String,
    duration: String,
    started_at: Date,
    ended_at: Date,
    provider_name: String,
    provider_id: String,
}, {
    versionKey: false,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
    toObject: { transform: (doc, ret) => { delete ret.__v; return ret; } }
});

module.exports = mongoose.model('ServiceTracking', service_tracking_schema);
