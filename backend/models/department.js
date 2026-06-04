const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: {
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

// Middleware to ensure services array exists and name is valid
DepartmentSchema.pre('save', function(next) {
  if (!this.services) {
    this.services = [];
  }
  this.updated_at = new Date();
  next();
});

// Handle duplicate key errors (E11000) for name field
DepartmentSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Department name already exists'));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('Department', DepartmentSchema);
