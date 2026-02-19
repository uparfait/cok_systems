const mongoose = require('mongoose');

const audit_schema = new mongoose.Schema({
    action: { type: String, required: true },
    time: { type: Date, default: Date.now },
    description: { type: String },
    user_id: { type: String }
});

module.exports = mongoose.model('Audit', audit_schema);