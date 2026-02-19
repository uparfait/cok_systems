const mongoose = require('mongoose');

const DailyParkingRecordSchema = new mongoose.Schema({
    plate_number: { 
        type: String, 
        required: true 
    }, // [cite: 332, 333]
    driver_identification: {
        type: { type: String }, // [cite: 334, 335]
        number: { type: String } // [cite: 336, 337]
    },
    driver_name: { 
        type: String 
    }, // [cite: 338, 339]
    driver_telephone: { 
        type: String 
    }, // [cite: 340]
    status: { 
        type: String, 
        enum: ['active', 'completed'], 
        default: 'active' 
    }, // [cite: 341, 352]
    driver_type: { 
        type: String, 
        enum: ['staff', 'visitor', 'regular'], 
        required: true 
    }, // [cite: 342, 353]
    slot_number: { 
        type: String 
    }, // [cite: 343]
    check_in: { 
        type: Date, 
        default: Date.now 
    }, // [cite: 344, 355]
    check_out: { 
        type: Date 
    }, // [cite: 345, 356]
    duration: { 
        type: String 
    }, // [cite: 346, 357]
    is_flagged: { 
        type: Boolean, 
        default: false 
    }, // 
    checked_in_by: { 
        type: String 
    } // [cite: 348, 359]
}, {
    // This ensures it saves to the exact collection name defined by your team in config.js
    collection: 'parking_slots', // [cite: 223]
    timestamps: true
});

module.exports = mongoose.model('DailyParkingRecord', DailyParkingRecordSchema);