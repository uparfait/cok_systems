const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    position: { type: Number, default: 0 }, // For ordering lists within a board
    color: { type: String, default: '#838c91' }, // Header color
    isDefault: { type: Boolean, default: false }, // Whether this is a system default list
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
listSchema.index({ board: 1, position: 1 });
listSchema.index({ archived: 1 });

module.exports = mongoose.model('List', listSchema);