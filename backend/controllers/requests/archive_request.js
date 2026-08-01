const mongoose = require('mongoose');
const Request = require('../../models/request.js');
const { logAuditEvent } = require('../../middlewares/audit');

module.exports = async function archive_request(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Invalid request ID format'
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Archive reason is required'
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

    if (requestDoc.status === 'Archived') {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Request is already archived'
      });
    }

    requestDoc.status = 'Archived';
    requestDoc.archive_reason = reason.trim();
    requestDoc.status_reason = reason.trim();
    requestDoc.updated_at = new Date();
    await requestDoc.save();

    await logAuditEvent('ARCHIVE', `Incoming correspondence archived: ${id}`, req, {
      resource: 'requests',
      resource_id: id,
      status_code: 200,
      metadata: {
        archive_reason: reason,
        subject: requestDoc.subject
      }
    });

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Request archived successfully',
      data: requestDoc
    });

  } catch (error) {
    console.error('Error in archive_request:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while archiving the request'
    });
  }
};
