const mongoose = require('mongoose');

const user_schema = new mongoose.Schema({
    full_name: { type: String, required: true },
    telephone: { type: String },
    identification: {
        id_type: { type: String },
        number: { type: String }
    },
    picture: { type: String },
    gender: { type: String },
    title: { type: String },
    email: { type: String, unique: true },
    department_name: { type: String },
    department_id: { type: String },
    password: { type: String },
    access_control: {
        is_locked: { type: Boolean, default: false },
        reason: { type: String },
        last_login_attempt: { type: Number, default: 0 }
    },
    auth: {
        access_token: {
            token_type: { type: String },
            token: { type: String }
        }
    },
    roles: {
        role_name: { type: String },
        permissions: [
            {
                resource: { type: String, required: true }, // e.g. "employees"
                actions: [
                    {
                        type: String,
                        required: true
                    }
                ]
            }
        ]
    }
    ,
    is_active: { type: Boolean, default: true },
    created_date: { type: Date, default: Date.now },
    is_account_activated: {type: Boolean},
    registered_by: { type: String }
}, {
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

module.exports = mongoose.model('User', user_schema);