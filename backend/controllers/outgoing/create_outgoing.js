const Outgoing = require('../../models/outgoing.js');
const { logAuditEvent } = require('../../middlewares/audit');

module.exports = async function create_outgoing(req, res) {
  try {
    const {
      request_id,
      reference_number,
      department_number,
      date_of_reception,
      date_of_recording,
      destination,
      subject,
      sign_by
    } = req.body || {};

    const createdBy = {
      name: req.user?.name || req.user?.full_name || 'System',
      _id: req.user?.id || req.user?._id,
      tel: req.user?.telephone || '',
      title: req.user?.title || ''
    };

    const outgoingDoc = new Outgoing({
      request_id: request_id || null,
      reference_number: reference_number || '',
      department_number: department_number || '',
      date_of_reception: date_of_reception || null,
      date_of_recording: date_of_recording || null,
      destination: destination || '',
      subject: subject || '',
      sign_by: sign_by || '',
      created_by: createdBy
    });

    await outgoingDoc.save();

    await logAuditEvent('CREATE', `Outgoing correspondence created: ${outgoingDoc._id}`, req, {
      resource: 'outgoing',
      resource_id: outgoingDoc._id.toString(),
      status_code: 201,
      metadata: {
        request_id: outgoingDoc.request_id?.toString() || null,
        subject: outgoingDoc.subject,
        destination: outgoingDoc.destination
      }
    });

    return res.status(201).json({
      success: true,
      type: 'success',
      message: 'Outgoing created successfully',
      data: outgoingDoc
    });

  } catch (error) {
    console.error('Error in create_outgoing:', error);
    await logAuditEvent('ERROR', `Failed to create outgoing correspondence: ${error.message}`, req, {
      resource: 'outgoing',
      status_code: 500,
      error_message: error.message
    });
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while creating the outgoing'
    });
  }
};
