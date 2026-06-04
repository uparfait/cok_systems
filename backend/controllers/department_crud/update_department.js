const Department = require('../../../models/department');

async function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    const { name, description, room_number, is_unit, parent_department, leader, department_leader, employees, services } = req.body;

    // Check if updating name and it already exists
    if (name) {
      const existingDept = await Department.findOne({ name, _id: { $ne: id } });
      if (existingDept) {
        return res.status(400).json({ success: false, message: 'Department with this name already exists' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (room_number !== undefined) updateData.room_number = room_number;
    if (is_unit !== undefined) updateData.is_unit = is_unit;
    if (parent_department !== undefined) updateData.parent_department = parent_department;
    
    // Handle leader field - accept both 'leader' and 'department_leader' from frontend
    if (leader !== undefined || department_leader !== undefined) {
      const leaderId = leader !== undefined ? leader : department_leader;
      updateData.leader = leaderId;
      updateData.department_leader = leaderId;
    }
    
    if (employees !== undefined) updateData.employees = employees;
    if (services !== undefined) {
      updateData.services = services.map(service => {
        if (service._id) {
          return {
            _id: service._id,
            name: service.name,
            description: service.description || '',
            createdAt: service.createdAt || new Date(),
          };
        } else {
          return {
            _id: new (require('mongoose')).Types.ObjectId(),
            name: service.name,
            description: service.description || '',
            createdAt: new Date(),
          };
        }
      });
    }
    updateData.updated_at = new Date();

    const updatedDepartment = await Department.findByIdAndUpdate(id, updateData, { new: true })
      .populate('leader', 'full_name email')
      .populate('department_leader', 'full_name email')
      .populate('employees', 'full_name email')
      .populate('parent_department', 'name');

    if (!updatedDepartment) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Department updated successfully',
      data: updatedDepartment 
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ success: false, message: 'Error updating department', error: error.message });
  }
}

module.exports = updateDepartment;
