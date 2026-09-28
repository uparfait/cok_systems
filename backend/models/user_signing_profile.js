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
    updated_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

module.exports = mongoose.model('UserSigningProfile', user_signing_profile_schema, 'user_signing_profiles');
