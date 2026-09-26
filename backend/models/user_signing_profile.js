const mongoose = require('mongoose');

// Kept apart from users on purpose: authenticate.js loads the whole user document on every request,
// and employee endpoints return whole users, so an image Buffer on users would ride along everywhere.
const user_signing_profile_schema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    signature_image: {
      data: { type: Buffer },
      mime: { type: String, default: 'image/png' },
      size: { type: Number },
      sha256: { type: String },
      uploaded_at: { type: Date },
    },
    signing_certificate: {
      thumbprint: { type: String }, // sha256 of the DER, lowercase hex, no colons - same derivation as em_backend
      spki_sha256: { type: String },
      serial_number: { type: String },
      subject_common_name: { type: String },
      subject_email: { type: String },
      issuer_common_name: { type: String },
      valid_from: { type: Date },
      valid_to: { type: Date },
      certificate_der: { type: String }, // base64, kept for audit only and never returned to the browser
      enrolled_at: { type: Date },
    },
    updated_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// One certificate can never be pinned to two accounts
user_signing_profile_schema.index({ 'signing_certificate.thumbprint': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('UserSigningProfile', user_signing_profile_schema, 'user_signing_profiles');
