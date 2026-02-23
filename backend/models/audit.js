const mongoose = require('mongoose');

const audit_schema = new mongoose.Schema({
    action: { type: String, required: true },
    time: { type: Date, default: Date.now },
    description: { type: String },
    user_id: { type: String }
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

module.exports = mongoose.model('Audit', audit_schema);