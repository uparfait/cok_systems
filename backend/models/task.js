const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    belongs: {
        isBelongsTo: { type: Boolean, default: false },
        itBelongsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceDelivery' }
    },

    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
    position: { type: Number, default: 0 }, // For ordering within lists

    incharge: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Additional assignees
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users watching this task

    title: { type: String, required: true},
    description: { type: String },
    status: {
        type: String,
        enum: ['Under-review', 'In-progress', 'Completed'],
        default: 'Under-review'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },

    labels: [{
        name: { type: String, required: true },
        color: { type: String, required: true }, // Hex color code
        _id: false
    }],

    dueDate: { type: Date },
    startDate: { type: Date },
    completedAt: { type: Date },
    archived: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    taskConfig: {
        coverImage: { type: String },
        coverColor: { type: String }, // For colored covers
        estimatedTime: { type: Number }, // In hours
        actualTime: { type: Number } // In hours
    },
    // Checklists
    checklists: [{
        title: { type: String, required: true },
        items: [{
            text: { type: String, required: true },
            completed: { type: Boolean, default: false },
            _id: false
        }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],

    comments: [{
        commenter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        comment: { type: String, required: true },
        mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users mentioned
        edited: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],

    attachmentsFile: [{
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'document', 'link', 'other'], default: 'other' },
        size: { type: Number }, // File size in bytes
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        uploadedAt: { type: Date, default: Date.now }
    }],

    // Activity log for tracking all changes
    activities: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        action: { type: String, required: true }, // 'created', 'updated', 'commented', 'moved', etc.
        details: { type: mongoose.Schema.Types.Mixed }, // Flexible object for action details
        timestamp: { type: Date, default: Date.now }
    }]
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


taskSchema.index({ board: 1, list: 1, position: 1 }); // For board/list ordering
taskSchema.index({ incharge: 1, status: 1 });
taskSchema.index({ members: 1 });
taskSchema.index({ watchers: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ archived: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ labels: 1 }); // For label filtering

module.exports = mongoose.model('Task', taskSchema);