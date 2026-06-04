const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: '',
  },
  room_number: {
    type: String,
    default: '',
  },
  is_unit: {
    type: Boolean,
    default: false,
  },
  parent_department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
  },
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  department_leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  employees: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  services: [
    {
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      description: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  is_active: {
    type: Boolean,
    default: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Department', DepartmentSchema);
