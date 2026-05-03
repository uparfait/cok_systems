const Notification = require('../../models/notification')
const { StatusCodes } = require('http-status-codes')

const getNotifications = async (req, res) => {
    try {
        const { userId, isRead, limit = 20, skip = 0 } = req.query

        const query = {}
        if (userId) query.user = userId
        if (isRead !== undefined) query.isRead = isRead === 'true'

        const notifications = await Notification.find(query)
            .populate('user', 'full_name email')
            .populate('task', 'title status dueDate')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))

        const total = await Notification.countDocuments(query)

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Notifications retrieved successfully',
            data: {
                notifications,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: total > parseInt(skip) + parseInt(limit)
                }
            }
        })

    } catch (error) {
        console.error('Error getting notifications:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to retrieve notifications',
            error: error.message
        })
    }
}

module.exports = getNotifications