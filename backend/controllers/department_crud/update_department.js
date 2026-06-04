const Department = require('../../models/department');
const mongoose = require('mongoose');

async function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        type: 'warning',
        message: 'Invalid department ID' 
      });
    }

    // Accept both 'name' and 'department_name' for backward compatibility
    let { name, department_name, description, room_number, is_unit, parent_department, leader, department_leader, employees, services } = req.body;
    
    // Use whichever field name is provided
    const deptName = (name || department_name || '').trim();

    // Check if updating name and it already exists (case-insensitive)
    if (deptName) {
      const existingDept = await Department.findOne({ 
        name: new RegExp(`^${deptName}$`, 'i'),
        _id: { $ne: id } 
      });
      if (existingDept) {
        return res.status(400).json({ 
          success: false,
          type: 'warning',
          message: 'Department with this name already exists' 
        });
      }
    }

    const updateData = {};
    if (deptName) updateData.name = deptName;
    if (description !== undefined) updateData.description = description;
    if (room_number !== undefined) updateData.room_number = room_number;
    if (is_unit !== undefined) updateData.is_unit = Boolean(is_unit);
    if (parent_department !== undefined) updateData.parent_department = parent_department;
    
    // Handle leader field - accept both 'leader' and 'department_leader' from frontend
    if (leader !== undefined || department_leader !== undefined) {
      const leaderId = leader !== undefined ? leader : department_leader;
      updateData.leader = leaderId || null;
      updateData.department_leader = leaderId || null;
    }
    
    if (employees !== undefined && Array.isArray(employees)) updateData.employees = employees;
    if (services !== undefined && Array.isArray(services)) {
      updateData.services = services.map(service => {
        if (service._id) {
          return {
            _id: service._id,
            name: service.name || 'Unnamed Service',
            description: service.description || '',
            createdAt: service.createdAt || new Date(),
          };
        } else {
          return {
            _id: new mongoose.Types.ObjectId(),
            name: service.name || 'Unnamed Service',
            description: service.description || '',
            createdAt: new Date(),
          };
        }
      });
    }
    updateData.updated_at = new Date();

    const updatedDepartment = await Department.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('leader', 'full_name email')
      .populate('department_leader', 'full_name email')
      .populate('employees', 'full_name email')
      .populate('parent_department', 'name');

    if (!updatedDepartment) {
      return res.status(404).json({ 
        success: false,
        type: 'warning',
        message: 'Department not found' 
      });
    }

    res.status(200).json({ 
      success: true,
      type: 'success',
      message: 'Department updated successfully',
      data: updatedDepartment 
    });
  } catch (error) {
    console.error('Error updating department:', error);
    
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
      message: 'Error updating department', 
      error: error.message 
    });
  }
}

module.exports = updateDepartment;
