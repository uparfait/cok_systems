const mongoose = require('mongoose');

const senderSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  telephone: { type: String, default: '' }
}, { _id: false });

const assignedBySchema = new mongoose.Schema({
  name: { type: String, required: true },
  _id: { type: mongoose.Schema.Types.ObjectId, required: true },
  tel: { type: String, default: '' },
  title: { type: String, default: '' }
}, { _id: false });

const requestSchema = new mongoose.Schema({
  redaction_date: { type: Date, default: null },
  reference_number: { type: String, default: '' },
  reception_date: { type: Date, default: null },
  sender: { type: senderSchema, default: () => ({}) },
  recipient: { type: String, default: 'COK' },
  subject: { type: String, default: '' },
  orientation: { type: String, default: '' },
  remarks: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Pending', 'Inprogress', 'Completed', 'Archived', 'Overdue'], 
    default: 'Pending' 
  },
  assigned_by: { type: assignedBySchema, required: true },
  created_by: { 
    type: assignedBySchema, 
    required: true 
  },
  archive_reason: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', requestSchema);
