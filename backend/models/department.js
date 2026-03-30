const mongoose = require('mongoose');

const department_schema = new mongoose.Schema({
    sub_department_mng: {
        is_sub_department: {type: boolean, default: false},
        parent_department_id: { type: String, default: null }
    },
    department_name: { type: String, required: true },
    department_response_time_in_minutes: { type: Number, default: 0 },
    department_id: { type: String, unique: true },
    created_date: { type: Date, default: Date.now },

    department_leader: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
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