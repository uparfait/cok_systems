const Router = require('express').Router();
const Audit = require('../../models/audit');
const User = require('../../models/user');

const authenticate = require('../../middlewares/authenticate');

// Middleware to log audit events
const logAudit = async (action, description, req, additionalData = {}) => {
 /// this function functionality made as middleware and not working again
};

// Export the logAudit function for use in other routes
Router.logAudit = logAudit;

/**
 * GET /audit/logs
 * Fetch audit logs with pagination and filtering
 */
Router.get('/logs', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      user_id,
      resource,
      start_date,
      end_date,
      sort = '-time'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter = {};

    if (action) filter.action = action;
    if (user_id) filter.user_id = user_id;
    if (resource) filter.resource = resource;

    // Date range filter
    if (start_date || end_date) {
      filter.time = {};
      if (start_date) filter.time.$gte = new Date(start_date);
      if (end_date) filter.time.$lte = new Date(end_date);
    }

    // Get total count
    const total = await Audit.countDocuments(filter);

    // Get audit logs with user population
    const audits = await Audit.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('user_id', 'full_name email') // Populate user details
      .lean();

    // Transform the data to include user info
    const transformedAudits = audits.map(audit => ({
      ...audit,
      user_name: audit.user_name || (audit.user_id?.full_name) || 'None',
      user_email: audit.user_email || (audit.user_id?.email) || null
    }));

    return res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: transformedAudits,
      pagination: {
        current_page: pageNum,
        per_page: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum * limitNum < total,
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs',
      error: error.message
    });
  }
});

/**
 * GET /audit/stats
 * Get audit statistics
 */
Router.get('/stats', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get statistics
    const [
      totalLogs,
      actionStats,
      userStats,
      recentErrors
    ] = await Promise.all([
      Audit.countDocuments({ time: { $gte: startDate } }),

      Audit.aggregate([
        { $match: { time: { $gte: startDate } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      Audit.aggregate([
        { $match: { time: { $gte: startDate }, user_id: { $ne: null } } },
        { $group: { _id: '$user_id', count: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, count: 1, user_name: '$user.full_name', user_email: '$user.email' } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      Audit.find({
        action: 'ERROR',
        time: { $gte: startDate }
      })
      .sort({ time: -1 })
      .limit(5)
      .select('description time user_name error_message')
    ]);

    return res.status(200).json({
      success: true,
      message: 'Audit statistics retrieved successfully',
      data: {
        total_logs: totalLogs,
        action_breakdown: actionStats,
        top_users: userStats,
        recent_errors: recentErrors
      }
    });

  } catch (error) {
    console.error('Error fetching audit stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit statistics',
      error: error.message
    });
  }
});

/**
 * DELETE /audit/logs/:id
 * Delete a specific audit log (admin only)
 */
Router.delete('/logs/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has admin permissions (you might want to add role checking here)
    const auditLog = await Audit.findByIdAndDelete(id);

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    // Log the deletion
    await logAudit('DELETE', `Deleted audit log: ${auditLog.description}`, req, {
      resource: 'audit_logs',
      resource_id: id
    });

    return res.status(200).json({
      success: true,
      message: 'Audit log deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting audit log:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete audit log',
      error: error.message
    });
  }
});

/**
 * POST /audit/test
 * Test endpoint to create sample audit logs (for development)
 */
Router.post('/test', authenticate, async (req, res) => {
  try {

    return res.status(200).json({
      success: true,
      message: `Working fine`,
      data: auditLogs
    });

  } catch (error) {
    console.error('Error creating test audit logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create test audit logs',
      error: error.message
    });
  }
});

module.exports = Router;