const mongoose = require('mongoose');

const emergency_car_schema = new mongoose.Schema({
    total_reserved_space: { type: Number },
    visitor_info: [{
        plate_number: String,
        driver_name: String,
        driver_type: { type: String, default: 'visitor', enum: ['visitor', 'staff'] },
        driver_identification: {
            id_type: String,
            number: String
        },
        telephone_number: String,
        slot_number: String,
        is_flagged: { type: Boolean, default: false },
        // Reservation window per visitor: only counts as reserved between valid_from
        // (start of that day) and valid_until (end of that day). Nulls are open-ended.
        // A reservation ends when the vehicle checks in (is_used), it is cancelled
        // (is_cancelled), or valid_until passes (auto-cancel sweep).
        is_used: { type: Boolean, default: false },
        used_at: { type: Date },
        is_cancelled: { type: Boolean, default: false },
        valid_from: { type: Date, default: null },
        valid_until: { type: Date, default: null }
    }],
    validity: {
        from: { type: Date },
        to: { type: Date }
    },
    is_active: { type: Boolean, default: true },
    registered_by: { type: String },
    // Uploaded-file name — lets the admin find, cancel, or reschedule a whole upload at once
    batch_name: { type: String, default: null }
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

module.exports = mongoose.model('EmergencyCar', emergency_car_schema);