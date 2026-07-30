const Request = require('../../models/request.js');
const { logAuditEvent } = require('../../middlewares/audit');

module.exports = async function create_request(req, res) {
  try {
    const {
      redaction_date,
      reference_number,
      reception_date,
      sender,
      recipient,
      subject,
      orientation,
      remarks,
      status,
      assigned_by
    } = req.body || {};

    const createdBy = {
      name: req.user?.name || req.user?.full_name || 'System',
      _id: req.user?.id || req.user?._id,
      tel: req.user?.telephone || '',
      title: req.user?.title || ''
    };

    const assignedBy = assigned_by || createdBy;

    const requestDoc = new Request({
      redaction_date: redaction_date || null,
      reference_number: reference_number || '',
      reception_date: reception_date || null,
      sender: sender || {},
      recipient: recipient || 'COK',
      subject: subject || '',
      orientation: orientation || '',
      remarks: remarks || '',
      status: status || 'Pending',
      assigned_by: assignedBy,
      created_by: createdBy
    });

    await requestDoc.save();

    await logAuditEvent('CREATE', `Incoming correspondence created: ${requestDoc._id}`, req, {
      resource: 'requests',
      resource_id: requestDoc._id.toString(),
      status_code: 201,
      metadata: {
        subject: requestDoc.subject,
        status: requestDoc.status,
        sender_name: requestDoc.sender?.name || 'N/A'
      }
    });

    return res.status(201).json({
      success: true,
      type: 'success',
      message: 'Incoming correspondence created successfully',
      data: requestDoc
    });

  } catch (error) {
    console.error('Error in create_request:', error);
    await logAuditEvent('ERROR', `Failed to create incoming correspondence: ${error.message}`, req, {
      resource: 'requests',
      status_code: 500,
      error_message: error.message
    });
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while creating the request'
    });
  }
};
