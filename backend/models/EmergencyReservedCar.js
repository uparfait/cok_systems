const mongoose = require('mongoose');

const EmergencyReservedCarSchema = new mongoose.Schema({
    total_reserved_space: {
        type: Number,
        required: true
    },
    visitor_info: [{
        plate_number: { type: String },
        driver_name: { type: String },
        driver_identification: {
            type: { type: String }, // e.g., "ID", "Passport"
            number: { type: String }
        },
        telephone_number: { type: String },
        is_flagged: { type: Boolean, default: false }
    }],
    validity: {
        from: { type: Date, required: true },
        to: { type: Date, required: true }
    },
    registered_by: {
        type: String, // This will store the Super Admin's ID or Name who uploaded the Excel file
        required: true
    }
}, {
    // Maps to the exact collection defined in your config.js
    collection: 'vistors_reserved',
    timestamps: true
});

module.exports = mongoose.model('EmergencyReservedCar', EmergencyReservedCarSchema);