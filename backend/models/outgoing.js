const mongoose = require('mongoose');

const outgoingSchema = new mongoose.Schema({
  request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', default: null },
  reference_number: { type: String, default: '' },
  department_number: { type: String, default: '' },
  date_of_reception: { type: Date, default: null },
  date_of_recording: { type: Date, default: null },
  destination: { type: String, default: '' },
  subject: { type: String, default: '' },
  sign_by: { type: String, default: '' },
  created_by: {
    name: { type: String, required: true },
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    tel: { type: String, default: '' },
    title: { type: String, default: '' }
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Outgoing', outgoingSchema);
