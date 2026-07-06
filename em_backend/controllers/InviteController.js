const InviteService = require('../services/InviteService');

class InviteController {
  static async handleInvite(req, res) {
    try {
      const { eventSpecialId } = req.params;
      const manualEmails = req.body.manualEmails || '';
      const file = req.file;

      if (!file && !manualEmails.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a file or enter email addresses manually',
        });
      }

      // Parse emails from file if provided
      let fileEmails = [];
      if (file) {
        // Check file line count (max 500 lines for CSV/TXT only)
        const isTextFile = file.mimetype === 'text/plain' || file.mimetype === 'text/csv' || file.originalname.match(/\.(csv|txt)$/i);
        if (isTextFile) {
          const lines = file.buffer.toString('utf-8').split('\n').length;
          if (lines > 500) {
            return res.status(400).json({
              success: false,
              message: 'File exceeds maximum of 500 lines',
            });
          }
        }
        fileEmails = InviteService.parseFile(file.buffer, file.mimetype);
      }

      // Parse manual emails
      const manualEmailList = InviteService.parseManualEmails(manualEmails);

      // Combine all emails (deduplication happens in service)
      const allEmails = [...new Set([...fileEmails, ...manualEmailList])];

      if (allEmails.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid email addresses found in the provided input',
        });
      }

      const result = await InviteService.invitePeoples(eventSpecialId, allEmails);

      return res.status(200).json({
        success: true,
        message: `${result.newlyInvited} people invited successfully`,
        data: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleGetInvited(req, res) {
    try {
      const { eventSpecialId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      const result = await InviteService.getInvitedPeoples(eventSpecialId, page, limit);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleRemoveInvited(req, res) {
    try {
      const { inviteId } = req.params;
      const result = await InviteService.removeInvitedPerson(inviteId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = InviteController;
