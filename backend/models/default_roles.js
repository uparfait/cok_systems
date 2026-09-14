const mongoose = require('mongoose');

const role_schema = new mongoose.Schema({
    role_name: { 
        type: String, 
        required: true, 
        unique: true 
    },
    permissions: [
        {
            resource_name: { type: String, required: true },
            actions: [
                {
                    action: { type: String, required: true },
                    description: { type: String },
                    is_enabled: { type: Boolean, default: false }
                }
            ]
        }
    ],
    // Custom-role navigation: toggled links from the shared link catalog
    // (configurations/Default_Roles.json). Each entry: { id, children: [childId] }.
    // Default roles keep this empty; their links come from the JSON file.
    // children: omitted or empty = every child of that catalog link; a
    // non-empty list = only those children. default undefined keeps an
    // omitted list from being stored as [] (which reads the same anyway).
    nav_links: [
        {
            id: { type: String, required: true },
            children: { type: [String], default: undefined }
        }
    ],
    // Where a user with this role lands after login ({roleSlug} placeholder allowed)
    default_route: { type: String, default: '' }
}, {
    timestamps: true,
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

module.exports = mongoose.model('Role', role_schema);