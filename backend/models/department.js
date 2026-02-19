const mongoose = require('mongoose');

const department_schema = new mongoose.Schema({
    department_name: { type: String, required: true },
    department_id: { type: String, unique: true },
    created_date: { type: Date, default: Date.now },
    department_leader: { type: String },
    total_employees: { type: Number, default: 0 },
    registered_by: { type: String }
});

module.exports = mongoose.model('Department', department_schema);