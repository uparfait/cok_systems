const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  department_name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    minlength: [1, 'Department name cannot be empty'],
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
  total_employees: {
    type: Number,
    default: 0,
    min: 0,
  },
  employees: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  services: [
    {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        auto: true,
      },
      name: {
        type: String,
        required: true,
      },
      description: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  department_id: {
    type: String,
    default: "",
  },
  department_response_time_in_minutes: {
    type: Number,
    default: 0,
    min: 0,
  },
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

// Index for faster employee queries and lookups
DepartmentSchema.index({ employees: 1 });
DepartmentSchema.index({ department_leader: 1 });
DepartmentSchema.index({ name: 1 });
DepartmentSchema.index({ parent_department: 1 });


module.exports = mongoose.model('Department', DepartmentSchema);