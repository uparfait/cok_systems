const mongoose = require('mongoose');

const flagged_vehicle_schema = new mongoose.Schema({
    plate_number: { type: String, required: true },
    driver_type: {
        type: String,
        enum: ['staff', 'visitor', 'regular'],
        required: true
    },
    // The person who came with the car and the parking session that overstayed
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', default: null },
    parking_record: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingRecord', default: null },
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
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
    toObject: { transform: (doc, ret) => { delete ret.__v; return ret; } }
});

flagged_vehicle_schema.index({ visitor: 1 });
flagged_vehicle_schema.index({ plate_number: 1, check_out_time: -1 });

module.exports = mongoose.model('FlaggedVehicle', flagged_vehicle_schema);
