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
  // Legacy unit format still present on older documents; without this in the
  // schema, Mongoose hides the field on documents and legacy units read as
  // plain departments everywhere the flag is checked in JS.
  sub_department_mng: {
    is_sub_department: { type: mongoose.Schema.Types.Mixed, default: undefined },
    parent_department_id: { type: String, default: undefined },
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
  dpt_id: {
    type: String,
    default: "",
    trim: true,
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


const Department = mongoose.model('Department', DepartmentSchema);

// The collection historically carried a unique index on department_id which made
// every insert without a distinct value fail with E11000. The field is now the
// optional, non-unique dpt_id, so that stale index is dropped once connected.
const dropStaleDepartmentIdIndex = () => {
  Department.collection.dropIndex('department_id_1').catch(() => {});
};
if (mongoose.connection.readyState === 1) dropStaleDepartmentIdIndex();
else mongoose.connection.once('connected', dropStaleDepartmentIdIndex);

module.exports = Department;