const mongoose = require('mongoose');

const staff_car_schema = new mongoose.Schema({
    plate_number: { type: String, required: true },
    id_type: { type: String, default: 'NID' },
    identification: { type: String },
    owner_name: { type: String },
    department_name: { type: String },
    owner_title: { type: String },
    telephone: {type: String , default: "Not Specified" },
    owner_picture: { type: String },
    is_active: { type: Boolean, default: true },
    registered_by: { type: String },
    is_flagged: { type: Boolean, default: false },
    // Optional reservation window (same semantics as visitor uploads): only reserved
    // between valid_from (start of day) and valid_until (end of day); nulls = permanent
    valid_from: { type: Date, default: null },
    valid_until: { type: Date, default: null },
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

module.exports = mongoose.model('StaffCar', staff_car_schema);