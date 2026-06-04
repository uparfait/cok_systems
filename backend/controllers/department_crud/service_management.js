const Department = require('../../models/department');
const mongoose = require('mongoose');

// Add a new service to a department
async function addService(req, res) {
  try {
    const { departmentId } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Service name is required' });
    }

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department ID is required' });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const newService = {
      _id: new mongoose.Types.ObjectId(),
      name,
      description: description || '',
      createdAt: new Date(),
    };

    department.services.push(newService);
    const updated = await department.save();

    res.status(201).json({
      success: true,
      message: 'Service added successfully',
      data: { services: updated.services },
    });
  } catch (error) {
    console.error('Error adding service:', error);
    res.status(500).json({ success: false, message: 'Error adding service', error: error.message });
  }
}

// Update a service in a department
async function updateService(req, res) {
  try {
    const { departmentId, serviceId } = req.params;
    const { name, description } = req.body;

    if (!departmentId || !serviceId) {
      return res.status(400).json({ success: false, message: 'Department ID and Service ID are required' });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const service = department.services.id(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (name !== undefined) service.name = name;
    if (description !== undefined) service.description = description;

    const updated = await department.save();

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: { services: updated.services },
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ success: false, message: 'Error updating service', error: error.message });
  }
}

// Delete a service from a department
async function deleteService(req, res) {
  try {
    const { departmentId, serviceId } = req.params;

    if (!departmentId || !serviceId) {
      return res.status(400).json({ success: false, message: 'Department ID and Service ID are required' });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Find the service in the array
    const serviceIndex = department.services.findIndex(s => s._id.toString() === serviceId);
    if (serviceIndex === -1) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Remove the service from the array
    department.services.splice(serviceIndex, 1);
    const updated = await department.save();

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
      data: { services: updated.services },
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ success: false, message: 'Error deleting service', error: error.message });
  }
}

module.exports = {
  addService,
  updateService,
  deleteService,
};
