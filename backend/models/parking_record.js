const mongoose = require('mongoose');

const parking_record_schema = new mongoose.Schema({
    plate_number: { type: String, required: true },
    driver_identification: {
        id_type: String,
        number: String
    },
    driver_name: { type: String, default: "Not Specified" },
    driver_telephone: { type: String, default: "Not Specified"  },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    driver_type: { type: String, enum: ['staff', 'visitor', 'regular', 'Staff', 'Regular', 'Visitor'] },
    driver_gender: {type: String, default: 'Not Specified' },
    slot_number: { type: String, default: "Not Specified"  },
    check_in: { type: Date, default: Date.now },
    check_out: { type: Date,  },
    duration: { type: String, default: '0 mins'  },
    is_flagged: { type: Boolean, default: false, default: false  },
    checked_in_by: { type: String, default: "Not Specified"  }
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

module.exports = mongoose.model('ParkingRecord', parking_record_schema);