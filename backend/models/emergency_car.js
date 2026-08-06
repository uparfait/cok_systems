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
        // A reservation never expires: it stays active until the vehicle checks in (is_used)
        // or the reservation is cancelled (is_cancelled) — both tracked per visitor
        is_used: { type: Boolean, default: false },
        used_at: { type: Date },
        is_cancelled: { type: Boolean, default: false }
    }],
    validity: {
        from: { type: Date },
        to: { type: Date }
    },
    is_active: { type: Boolean, default: true },
    registered_by: { type: String }
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