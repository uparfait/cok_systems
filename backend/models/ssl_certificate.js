const mongoose = require('mongoose');

/**
 * One document per SSL certificate that has been installed on the host
 * nginx, keyed by its SHA-256 fingerprint. Written by
 * utilities/certificate_request.js from the status file the deployment
 * agent keeps (deploy/runs/certificate.json): "upload" when the
 * certificate arrived through the Deployment Management page, "detected"
 * when the agent found it already installed. The newest document is what
 * the page counts down to.
 */
const ssl_certificate_schema = new mongoose.Schema({
    fingerprint: { type: String, required: true, unique: true, index: true },
    subject: { type: String, default: null },
    issuer: { type: String, default: null },
    hosts: { type: [String], default: [] },
    not_before: { type: Date, default: null },
    not_after: { type: Date, default: null, index: true },
    installed_at: { type: Date, default: Date.now, index: true },
    installed_by: {
        user_id: { type: String, default: null },
        email: { type: String, default: null },
    },
    run_id: { type: String, default: null },
    file_name: { type: String, default: null },
    source: { type: String, enum: ['upload', 'detected'], default: 'detected' },
    checked_at: { type: Date, default: null },
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

module.exports = mongoose.model('SslCertificate', ssl_certificate_schema);
