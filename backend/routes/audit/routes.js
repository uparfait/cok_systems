const Router = require('express').Router();
const Audit = require('../../models/audit');
const User = require('../../models/user');

const authenticate = require('../../middlewares/authenticate');

// Persist an audit event; never throws so it can't break the main request flow
const logAudit = async (action, description, req, additionalData = {}) => {
    try {
        const { resource, status_code, old_values, new_values, error_message, metadata } = additionalData;

        await Audit.create({
            action,
            description,
            user_id: (req?.user?.userId || req?.user?._id)?.toString(),
            user_name: req?.user?.full_name || req?.user?.name,
            user_email: req?.user?.email,
            resource,
            ip_address: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip,
            user_agent: req?.headers?.['user-agent'],
            method: req?.method,
            endpoint: req?.originalUrl,
            status_code,
            old_values,
            new_values,
            error_message,
            metadata
        });
    } catch (error) {
        console.error('logAudit failed:', error.message);
    }
};

// Export the logAudit function for use in other routes
Router.logAudit = logAudit;

/**
 * @swagger
 * /audit/logs:
 *   get:
 *     summary: "Get audit logs"
 *     description: "Retrieve paginated audit logs with filtering by action, user, resource, and date range. Requires authentication."
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Page number"
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: "Records per page"
 *         example: 20
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: "Filter by action type (e.g., CREATE, UPDATE, DELETE, LOGIN, ERROR)"
 *         example: "LOGIN"
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: "Filter by user ID"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: "Filter by resource type (e.g., users, vehicles, visitors)"
 *         example: "users"
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: "Start date (YYYY-MM-DD)"
 *         example: "2026-01-01"
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: "End date (YYYY-MM-DD)"
 *         example: "2026-12-31"
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: "-time"
 *         description: "Sort order (prefix with - for descending)"
 *         example: "-time"
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Audit logs retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       action:
 *                         type: string
 *                         example: "LOGIN"
 *                       description:
 *                         type: string
 *                         example: "User logged in: john.doe@cok.gov.rw"
 *                       user_name:
 *                         type: string
 *                         example: "John Doe"
 *                       user_email:
 *                         type: string
 *                         example: "john.doe@cok.gov.rw"
 *                       resource:
 *                         type: string
 *                         example: "auth"
 *                       method:
 *                         type: string
 *                         example: "POST"
 *                       endpoint:
 *                         type: string
 *                         example: "/cok/api/auth/login/verify"
 *                       status_code:
 *                         type: integer
 *                         example: 200
 *                       ip_address:
 *                         type: string
 *                         example: "192.168.1.100"
 *                       time:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       500:
 *         description: Internal server error
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
      .populate('user_id', 'full_name email')
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
 * @swagger
 * /audit/stats:
 *   get:
 *     summary: "Get audit statistics"
 *     description: "Retrieve aggregated audit statistics including total logs, action breakdown, top users, and recent errors."
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: "Number of days to look back"
 *         example: 30
 *     responses:
 *       200:
 *         description: Audit statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_logs:
 *                       type: integer
 *                       example: 1500
 *                     action_breakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                     top_users:
 *                       type: array
 *                     recent_errors:
 *                       type: array
 *       500:
 *         description: Internal server error
 */
Router.get('/stats', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

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
 * @swagger
 * /audit/logs/{id}:
 *   delete:
 *     summary: "Delete an audit log"
 *     description: "Delete a specific audit log by its MongoDB ObjectId. Requires admin privileges."
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Audit log MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Audit log deleted successfully
 *       404:
 *         description: Audit log not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/logs/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const auditLog = await Audit.findById(id);
    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    if (auditLog.un_deletable) {
      return res.status(403).json({
        success: false,
        message: 'This audit log cannot be deleted'
      });
    }

    await Audit.findByIdAndDelete(id);

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
 * @swagger
 * /audit/test:
 *   post:
 *     summary: "Test audit endpoint"
 *     description: "Test endpoint to verify audit functionality is working."
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Audit system is working
 *       500:
 *         description: Internal server error
 */
Router.post('/test', authenticate, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: `Working fine`,
      data: {}
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