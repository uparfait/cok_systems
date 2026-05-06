const Notification = require('../../models/notification')
const { StatusCodes } = require('http-status-codes')

const markAllAsRead = async (req, res) => {
    try {
        const { userId } = req.body

        if (!userId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'User ID is required'
            })
        }

        const result = await Notification.updateMany(
            { user: userId, isRead: false },
            { isRead: true }
        )

        res.status(StatusCodes.OK).json({
            status: true,
            message: `${result.modifiedCount} notifications marked as read`,
            data: { modifiedCount: result.modifiedCount }
        })

    } catch (error) {
        console.error('Error marking all notifications as read:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to mark notifications as read',
            error: error.message
        })
    }
}

module.exports = markAllAsRead