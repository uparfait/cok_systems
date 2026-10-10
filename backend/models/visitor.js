const mongoose = require('mongoose');

// One document per real person. Visits (ServiceDelivery) and parking sessions
// (ParkingRecord) only keep a reference to it.
const STRING_ONLY = (path) => ({ [path]: { $type: 'string' } });

const visitor_schema = new mongoose.Schema({
    identification: {
        id_type: { type: String, trim: true },
        number: { type: String, trim: true }
    },
    full_name: { type: String, required: true, trim: true },
    telephone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gender: { type: String, enum: ['Male', 'Female'] },
    Is_In_House: { type: Boolean, default: false },
    N_visits: { type: Number, default: 0, min: 0 },
    created_by: {
        user_id: String,
        name: String
    },
    updated_by: {
        user_id: String,
        name: String
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
    toObject: { transform: (doc, ret) => { delete ret.__v; return ret; } }
});

// Unique only when the value is present: optional values are stored as
// undefined so missing emails never collide with each other.
visitor_schema.index({ 'identification.number': 1 }, { unique: true, partialFilterExpression: STRING_ONLY('identification.number') });
visitor_schema.index({ telephone: 1 }, { unique: true, partialFilterExpression: STRING_ONLY('telephone') });
visitor_schema.index({ email: 1 }, { unique: true, partialFilterExpression: STRING_ONLY('email') });
visitor_schema.index({ Is_In_House: -1, updatedAt: -1 });
visitor_schema.index({ full_name: 1 });
visitor_schema.index({ N_visits: 1 });

module.exports = mongoose.model('Visitor', visitor_schema);
