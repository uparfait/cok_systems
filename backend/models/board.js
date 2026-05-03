const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String },
    background: {
        type: { type: String, enum: ['color', 'image'], default: 'color' },
        value: { type: String, default: '#0079bf' } // Default blue color
    },
    visibility: {
        type: String,
        enum: ['private', 'workspace', 'public'],
        default: 'private'
    },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' }, // Optional workspace grouping
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['admin', 'member', 'observer'], default: 'member' },
        addedAt: { type: Date, default: Date.now },
        _id: false
    }],
    labels: [{
        name: { type: String, required: true },
        color: { type: String, required: true },
        uses: { type: Number, default: 0 }
    }],
    starred: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who starred this board
    archived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
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

// Indexes
boardSchema.index({ createdBy: 1 });
boardSchema.index({ members: 1 });
boardSchema.index({ archived: 1 });
boardSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Board', boardSchema);