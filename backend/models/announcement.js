const mongoose = require('mongoose');

const announcement_schema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    a_type: {
        type: String,
        enum: ['Announcement', 'Notice', 'Directive'],
        default: 'Announcement'
    },
    department_id: { type: String, required: true },
    department_name: { type: String, default: '' },
    created_by: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, default: '' },
        title: { type: String, default: '' }
    },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now }
}, {
    versionKey: false
});

announcement_schema.index({ department_id: 1, created_at: -1 });

module.exports = mongoose.model('Announcement', announcement_schema);
