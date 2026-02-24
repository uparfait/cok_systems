const mongoose = require('mongoose');

const department_schema = new mongoose.Schema({
    department_name: { type: String, required: true },
    department_response_time_in_minutes: { type: Number, default: 0 },
    department_id: { type: String, unique: true },
    created_date: { type: Date, default: Date.now },
    // Updated department_leader to hold an object
    department_leader: { 
        name: { type: String },
        email: { type: String },
        title: { type: String },
        picture: { type: String }
    },
    total_employees: { type: Number, default: 0 },
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

module.exports = mongoose.model('Department', department_schema);