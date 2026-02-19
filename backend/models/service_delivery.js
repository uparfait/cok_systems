const mongoose = require('mongoose');

const service_delivery_schema = new mongoose.Schema({
    identification: {
        id_type: String,
        number: String
    },
    full_name: { type: String },
    telephone: { type: String },
    email: { type: String },
    department_name: { type: String },
    department_id: { type: String },
    date: { type: Date, default: Date.now },
    gender: { type: String },
    durations: {
        service_duration: String,
        entry_duration: String,
        emergency_duration: String
    },
    items: { type: String },
    status: { 
        type: String, 
        enum: ['pending', 'inprogress', 'transfered', 'completed'],
        default: 'pending'
    },
    notes: [String],
    registered_by: { type: String }
});

module.exports = mongoose.model('ServiceDelivery', service_delivery_schema);