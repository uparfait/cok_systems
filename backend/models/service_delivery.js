const mongoose = require('mongoose');

// One document per visit. Who the visitor is lives in the Visitor model;
// this document only keeps the reference and what happened during the visit.
const attachment_schema = new mongoose.Schema({
    description: { type: String, required: true, trim: true },
    file_name: { type: String, required: true },
    stored_name: { type: String, required: true },
    mime_type: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    uploaded_by: {
        user_id: String,
        name: String,
        email: String,
        telephone: String,
        department_id: String,
        department_name: String
    },
    uploaded_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: null }
});

const service_delivery_schema = new mongoose.Schema({
    // Always set for new visits (utilities/visitors/visits.js). Not required at
    // schema level so records of the old structure stay readable until cleaned up.
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', default: null, index: true },
    is_being_served: { type: Boolean, default: false },
    current_server: {
        type: {
            user_id: String,
            name: String,
            email: String,
            department_id: String,
            department_name: String,
            started_at: Date
        },
        default: null
    },
    vehicle_storage: {
        has_vehicle: { type: Boolean, default: false },
        parking_record: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingRecord', default: null },
        vehicle_details: {
            plate_number: String,
            entered_time: Date,
            exited_time: Date,
            duration: String,
        }
    },
    registered_by: { type: String, default: '' },
    departments_assigned: [
        {
            department_id: String,
            department_name: String,
            assigned_time: { type: Date, default: Date.now },
            reached_in: { type: Boolean, default: false },
            provider_name: String,
            provider_id: String,
            assigned_by: {
                user_id: String,
                name: String,
                email: String
            }
        }
    ],
    entry_date: { type: Date, default: Date.now },
    exist_date: { type: Date, default: null },
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
            s_type: { type: String, enum: ['Not started', 'Inprogress', 'Transfered', 'Completed'] },
        }
    ],
    attachments: [attachment_schema],
    is_still_inhouse: { type: Boolean, default: true },
    marked_as_out: { type: Boolean, default: false },
    notes: [{
        writter_name: String,
        message: String,
        timestamp: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true,
    versionKey: false,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
    toObject: { transform: (doc, ret) => { delete ret.__v; return ret; } }
});

// A visitor can have only one open visit. Records from the old structure
// (no visitor reference) are left out of the rule until they are cleaned up.
service_delivery_schema.index(
    { visitor: 1 },
    { unique: true, name: 'one_open_visit_per_visitor', partialFilterExpression: { is_still_inhouse: true, visitor: { $type: 'objectId' } } }
);
service_delivery_schema.index({ is_still_inhouse: 1, entry_date: -1 });
service_delivery_schema.index({ 'departments_assigned.department_id': 1, is_still_inhouse: 1 });
service_delivery_schema.index({ 'attachments._id': 1 });

module.exports = mongoose.model('ServiceDelivery', service_delivery_schema);
