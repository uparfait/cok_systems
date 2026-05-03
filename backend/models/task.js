const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    belongs: {
        isBelongsTo: { type: Boolean, default: false },
        itBelongsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceDelivery' }
    },
    incharge: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: {
        type: String,
        enum: ['Under-review', 'In-progress', 'Completed'],
        default: 'Under-review'
    },

    dueDate: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    taskConfig: {
        coverImage: { type: String }
    },
    comments: [{
        commenter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],
    attachmentsFile: [{
        filename: { type: String, required: true },
        url: { type: String, required: true },
        description: { type: String }
    }],
    subtasks: [{
        title: { type: String, required: true },
        description: { type: String },
        status: {
            type: String,
            enum: ['Under-review', 'In-progress', 'Completed'],
            default: 'Under-review'
        },
        dueDate: { type: Date },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
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

// Index for performance
taskSchema.index({ incharge: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Task', taskSchema);