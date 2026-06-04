const Department = require('../../models/department');
const mongoose = require('mongoose');

async function createDepartment(req, res) {
  try {
    // Accept both 'name' and 'department_name' for backward compatibility
    let { name, department_name, description, room_number, is_unit, parent_department, leader, department_leader, employees, services } = req.body;
    
    // Use whichever field name is provided
    const deptName = (name || department_name || '').trim();

    // Validate required field
    if (!deptName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department name is required',
        type: 'warning'
      });
    }

    // Check if department with this name already exists (case-insensitive)
    const existingDept = await Department.findOne({ name: new RegExp(`^${deptName}$`, 'i') });
    if (existingDept) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department with this name already exists',
        type: 'warning'
      });
    }

    const leaderId = leader || department_leader || null;

    const newDepartment = new Department({
      name: deptName,
      description: description || '',
      room_number: room_number || '',
      is_unit: Boolean(is_unit),
      parent_department: parent_department || null,
      leader: leaderId,
      department_leader: leaderId,
      total_employees: 0,
      employees: employees && Array.isArray(employees) ? employees : [],
      services: (services && Array.isArray(services) ? services : []).map(service => ({
        _id: new mongoose.Types.ObjectId(),
        name: service.name || 'Unnamed Service',
        description: service.description || '',
        createdAt: new Date(),
      })),
    });

    const savedDepartment = await newDepartment.save();
    
    // Populate references
    const populatedDept = await Department.findById(savedDepartment._id)
      .populate('leader', 'full_name email')
      .populate('department_leader', 'full_name email')
      .populate('employees', 'full_name email')
      .populate('parent_department', 'name');

    res.status(201).json({ 
      success: true,
      type: 'success',
      message: 'Department created successfully',
      data: populatedDept 
    });
  } catch (error) {
    console.error('Error creating department:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ 
        success: false,
        type: 'warning',
        message: messages.join(', ') || 'Validation failed',
        error: error.message
      });
    }

    res.status(500).json({ 
      success: false,
      type: 'error',
      message: 'Error creating department', 
      error: error.message 
    });
  }
}

module.exports = createDepartment;
