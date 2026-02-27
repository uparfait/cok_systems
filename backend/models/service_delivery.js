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
            provider_name: String,
            provider_id: String
        }
    ],
    entry_date: { type: Date, default: Date.now },
    exist_date: { type: Date, default: null },
    gender: { type: String, default: 'Not Specified' },
    durations: {
        services_durations: [
            {
                department_id: String,
                department_name: String,
                duration: String,
                started_at: Date,
                ended_at: Date,
                provider_name: String,
                provider_id: String,
            }
        ],
        entry_and_leave_duration: String,
        emergency_durations: [
            {
                type_of_emergency: {
                    type: String,
                    enum: ['Leave outside', 'Other'],
                    default: 'Other'
                },

                duration: String,
                started_at: Date,
                ended_at: Date,
                provider_name: String,
                provider_id: String,
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
            provider_id: String,
            s_type: {type: String, enum: ['Not started', 'Inprogress', 'Transfered', 'Completed']},
            
        }
    ],
    is_still_inhouse: { type: Boolean, default: true },
    notes: [{
        writter_name: String,
        message: String,
        timestamp: { type: Date, default: Date.now }
    }],
    registered_by: { type: String }
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

module.exports = mongoose.model('ServiceDelivery', service_delivery_schema);