const Notification = require('../../models/notification')
const { StatusCodes } = require('http-status-codes')

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params

        const notification = await Notification.findByIdAndUpdate(
            id,
            { isRead: true },
            { new: true }
        ).populate('user', 'full_name email')
         .populate('task', 'title status dueDate')

        if (!notification) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Notification not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Notification marked as read',
            data: notification
        })

    } catch (error) {
        console.error('Error marking notification as read:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to mark notification as read',
            error: error.message
        })
    }
}

module.exports = markAsRead