const Outgoing = require('../../models/outgoing.js');
const mongoose = require('mongoose');

module.exports = async function get_outgoing_by_request(req, res) {
  try {
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Invalid request ID format'
      });
    }

    const outgoing = await Outgoing.findOne({ request_id: requestId }).lean();

    return res.status(200).json({
      success: true,
      type: 'success',
      message: outgoing ? 'Outgoing correspondence found' : 'No outgoing correspondence found',
      data: outgoing
    });

  } catch (error) {
    console.error('Error in get_outgoing_by_request:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while fetching outgoing correspondence'
    });
  }
};
