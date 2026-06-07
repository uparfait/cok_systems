const Department = require("../../models/department.js");

async function createDepartment(req, res) {
  try {
    const { name, description, room_number, is_unit, parent_department, leader, department_leader, employees, services, department_id } = req.body;

    // Check if department with this name already exists
    const existingDept = await Department.findOne({ name });
    if (existingDept) {
      return res.status(400).json({ success: false, message: 'Department with this name already exists' });
    }

    const leaderId = leader || department_leader;

    const newDepartment = new Department({
      name,
      description: description || '',
      room_number: room_number || '',
      is_unit: is_unit || false,
      parent_department: parent_department || null,
      leader: leaderId || null,
      department_leader: leaderId || null,
      department_id: department_id || "", 
      employees: employees || [],
      services: (services || []).map(service => ({
        _id: new (require('mongoose')).Types.ObjectId(),
        name: service.name,
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
      message: 'Department created successfully',
      data: populatedDept 
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ success: false, message: 'Error creating department', error: error.message });
  }
}

module.exports = createDepartment;
