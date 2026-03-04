const mongoose = require('mongoose');

const role_schema = new mongoose.Schema({
    role_name: { 
        type: String, 
        required: true, 
        unique: true 
    },
    permissions: [
        {
        
        resource_name: { type: String, required: true },
        permissions: {
            action: { type: String, required: true },
            description: { type: String },
            is_enabled: { type: Boolean, default: false }
        }
    }
    ]
}, {
    versionKey: false,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.__v;
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

module.exports = mongoose.model('Role', role_schema);
