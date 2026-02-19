const mongoose = require('mongoose');

const staff_car_schema = new mongoose.Schema({
    plate_number: { type: String, required: true },
    identification: { type: String },
    owner_name: { type: String },
    department_name: { type: String },
    is_active: { type: Boolean, default: true },
    registered_by: { type: String },
    is_flagged: { type: Boolean, default: false }
});

module.exports = mongoose.model('StaffCar', staff_car_schema);