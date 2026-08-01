const mongoose = require('mongoose');
const Outgoing = require('../../models/outgoing.js');
const { logAuditEvent } = require('../../middlewares/audit');

module.exports = async function update_outgoing(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Invalid outgoing ID format'
      });
    }

    const outgoingDoc = await Outgoing.findById(id);
    if (!outgoingDoc) {
      return res.status(404).json({
        success: false,
        type: 'warning',
        message: 'Outgoing not found'
      });
    }

    const allowedFields = [
      'reference_number', 'department_number', 'date_of_reception',
      'date_of_recording', 'destination', 'subject', 'sign_by'
    ];

    const changedFields = [];
    const oldValues = {};
    const newValues = {};

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        const newValue = typeof updates[field] === 'object'
          ? JSON.stringify(updates[field])
          : updates[field];
        const currentValue = typeof outgoingDoc[field] === 'object' && outgoingDoc[field] !== null
          ? JSON.stringify(outgoingDoc[field])
          : outgoingDoc[field];

        if (String(newValue) !== String(currentValue)) {
          oldValues[field] = outgoingDoc[field];
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
      outgoingDoc[field] = updates[field];
    });

    outgoingDoc.updated_at = new Date();
    await outgoingDoc.save();

    await logAuditEvent('UPDATE', `Outgoing correspondence updated: ${id}`, req, {
      resource: 'outgoing',
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
      message: 'Outgoing updated successfully',
      data: outgoingDoc
    });

  } catch (error) {
    console.error('Error in update_outgoing:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while updating the outgoing'
    });
  }
};
