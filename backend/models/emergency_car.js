const mongoose = require('mongoose');

const emergency_car_schema = new mongoose.Schema({
    total_reserved_space: { type: Number },
    visitor_info: [{
        plate_number: String,
        driver_name: String,
        driver_type: { type: String, default: 'visitor' },
        driver_identification: {
            id_type: String,
            number: String
        },
        telephone_number: String,
        slot_number: String,
        is_flagged: { type: Boolean, default: false }
    }],
    validity: {
        from: { type: Date },
        to: { type: Date }
    },
    registered_by: { type: String }
});

module.exports = mongoose.model('EmergencyCar', emergency_car_schema);