const mongoose = require('mongoose');

const service_tracking_schema = new mongoose.Schema({

    department_id: String,
    department_name: String,
    duration: String,
    started_at: Date,
    ended_at: Date,
    provider_name: String,
    provider_id: String,

});

module.exports = mongoose.model('ServiceTracking', service_tracking_schema);