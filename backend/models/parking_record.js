const mongoose = require('mongoose');

const parking_record_schema = new mongoose.Schema({
    plate_number: { type: String, required: true },
    driver_identification: {
        id_type: String,
        number: String
    },
    driver_name: { type: String },
    driver_telephone: { type: String },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    driver_type: { type: String, enum: ['staff', 'visitor', 'regular'] },
    slot_number: { type: String },
    check_in: { type: Date, default: Date.now },
    check_out: { type: Date },
    duration: { type: String },
    is_flagged: { type: Boolean, default: false },
    checked_in_by: { type: String }
});

module.exports = mongoose.model('ParkingRecord', parking_record_schema);