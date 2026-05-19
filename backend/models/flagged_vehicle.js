const mongoose = require('mongoose');

const flagged_vehicle_schema = new mongoose.Schema({
    plate_number: { type: String, required: true },
    driver_type: { 
        type: String, 
        enum: ['staff', 'visitor', 'regular'], 
        required: true 
    },
    driver_name: { type: String, default: "Not Specified" },
    driver_telephone: { type: String, default: "Not Specified" },
    driver_identification: {
        id_type: String,
        number: String
    },
    slot_number: { type: String, default: "Not Specified" },
    checked_in_by: { type: String, default: "Not Specified" },
    check_in_time: { type: Date, required: true },
    flagged_at: { type: Date, required: true }, // The exact minute their allowed time expired
    check_out_time: { type: Date }, // Will be filled in when they finally leave
    
    allowed_duration_minutes: { type: Number, required: true }, // E.g., 120 minutes allowed
    total_duration_minutes: { type: Number }, // Total time parked (Check-In to Check-Out)
    flagged_duration_minutes: { type: Number }, // Time spent ILLEGALLY (Flagged Time to Check-Out)

    reason: { type: String, default: 'System Automated Flag: Exceeded allowed parking duration' }
}, {
    versionKey: false,
    timestamps: true,
    // Added your clean-up transformers from the parking record!
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

module.exports = mongoose.model('FlaggedVehicle', flagged_vehicle_schema);