const mongoose = require('mongoose');

const service_delivery_schema = new mongoose.Schema({
    identification: {
        id_type: String,
        number: String
    },
    vehicle_storage: {
        has_vehicle: { type: Boolean, default: false },
        vehicle_details: {
            plate_number: String,
            entered_time: Date,
            exited_time: Date,
            duration: String,
        }
    },
    full_name: { type: String },
    telephone: { type: String },
    email: { type: String },
    departments_assigned: [
        {
            department_id: String,
            department_name: String,
            assigned_time: { type: Date, default: Date.now },
            reached_in: { type: Boolean, default: false },
            provider_name: String
        }
    ],
    entry_date: { type: Date, default: Date.now },
    gender: { type: String },
    durations: {
        services_durations: [
            {
                department_id: String,
                department_name: String,
                duration: String,
                started_at: Date,
                ended_at: Date,
                provider_name: String
            }
        ],
        entry_duration: String,
        emergency_durations: [
            {
                type_of_emergency: {
                    type: String,
                    enum: ['Transifer to another department', 'Leave outside', 'Other'],
                    default: 'Other'
                },

                duration: String,
                started_at: Date,
                ended_at: Date,
                provider_name: String,
            }
        ]
    },
    items_entered_with: [
        {
            item_name: String,
            quantity: Number
        }
    ],
    items_exited_with: [
        {
            item_name: String,
            quantity: Number,
            description: { type: String, default: "Not specified" }
        }
    ],
    services_status: [
        {
            department_name: String,
            department_id: String,
            provider_name: String,
            type: String,
            enum: ['not started', 'inprogress', 'transfered', 'completed'],
            default: 'not started'
        }
    ],
    is_still_inhouse: { type: Boolean, default: true },
    notes: [{
        writter_name: String,
        message: String,
        timestamp: { type: Date, default: Date.now }
    }],
    registered_by: { type: String }
});

module.exports = mongoose.model('ServiceDelivery', service_delivery_schema);