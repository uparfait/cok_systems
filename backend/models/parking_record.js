const mongoose = require('mongoose');

// One document per parking session. The person who came with the car lives in
// the Visitor model; this document keeps only the reference.
const parking_record_schema = new mongoose.Schema({
    plate_number: { type: String, required: true },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', default: null },
    service_delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceDelivery', default: null },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    driver_type: { type: String, enum: ['staff', 'visitor', 'regular'] },
    slot_number: { type: String, default: "Not Specified" },
    // Optional badge of the person who came with the car, same value as their visit
    badge_number: { type: String, trim: true, default: null },
    check_in: { type: Date, default: Date.now },
    check_out: { type: Date },
    duration: { type: String, default: '0 mins' },
    is_flagged: { type: Boolean, default: false },
    // Permanent flag history: set once when flagged, never cleared by a later check-in
    flagged_at: { type: Date, default: null },
    flag_reason: { type: String, default: null },
    checked_in_by: { type: String, default: "Not Specified" }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
    toObject: { transform: (doc, ret) => { delete ret.__v; return ret; } }
});

// A plate can have only one active session (records of the old structure,
// which have no visitor reference, are left out until they are cleaned up).
parking_record_schema.index(
    { plate_number: 1 },
    { unique: true, name: 'one_active_session_per_plate', partialFilterExpression: { status: 'active', visitor: { $type: 'objectId' } } }
);
parking_record_schema.index({ visitor: 1, check_in: -1 });
parking_record_schema.index({ plate_number: 1, check_in: -1 });
parking_record_schema.index({ status: 1, check_in: -1 });
parking_record_schema.index({ check_in: 1 });
parking_record_schema.index({ check_out: 1 });
parking_record_schema.index({ flagged_at: 1 });

module.exports = mongoose.model('ParkingRecord', parking_record_schema);
