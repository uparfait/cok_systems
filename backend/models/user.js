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
    password: { type: String, required: true },
    access_control: {
        is_locked: { type: Boolean, default: false },
        reason: { type: String },
        last_login_attempt: { type: Number, default: 0 }
    },
    auth: {
        access_token: { 
            type: String,
            token: String
         }
    },
    roles: {
        role_name: { type: String },
        permissions: [String]
    },
    is_active: { type: Boolean, default: true },
    created_date: { type: Date, default: Date.now },
    registered_by: { type: String }
});

module.exports = mongoose.model('User', user_schema);