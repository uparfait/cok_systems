const mongoose = require('mongoose');
const Request = require('../../models/request.js');
const { logAuditEvent } = require('../../middlewares/audit');

module.exports = async function update_request(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Invalid request ID format'
      });
    }

    const requestDoc = await Request.findById(id);
    if (!requestDoc) {
      return res.status(404).json({
        success: false,
        type: 'warning',
        message: 'Request not found'
      });
    }

    const allowedFields = [
      'redaction_date', 'reference_number', 'reception_date', 'sender',
      'recipient', 'subject', 'orientation', 'remarks', 'status', 'assigned_by'
    ];

    const changedFields = [];
    const oldValues = {};
    const newValues = {};

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        const newValue = typeof updates[field] === 'object' 
          ? JSON.stringify(updates[field]) 
          : updates[field];
        const currentValue = typeof requestDoc[field] === 'object' && requestDoc[field] !== null
          ? JSON.stringify(requestDoc[field])
          : requestDoc[field];
        
        if (String(newValue) !== String(currentValue)) {
          oldValues[field] = requestDoc[field];
          newValues[field] = updates[field];
          changedFields.push(field);
        }
      }
    });

    if (changedFields.length === 0) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'No changes detected'
      });
    }

    changedFields.forEach(field => {
      requestDoc[field] = updates[field];
    });

    requestDoc.updated_at = new Date();
    await requestDoc.save();

    await logAuditEvent('UPDATE', `Incoming correspondence updated: ${id}`, req, {
      resource: 'requests',
      resource_id: id,
      status_code: 200,
      metadata: {
        changed_fields: changedFields,
        old_values: oldValues,
        new_values: newValues
      }
    });

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Request updated successfully',
      data: requestDoc
    });

  } catch (error) {
    console.error('Error in update_request:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while updating the request'
    });
  }
};
