const Notification = require('../../models/notification')
const { StatusCodes } = require('http-status-codes')

const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params

        const deletedNotification = await Notification.findByIdAndDelete(id)

        if (!deletedNotification) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Notification not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Notification deleted successfully',
            data: deletedNotification
        })

    } catch (error) {
        console.error('Error deleting notification:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to delete notification',
            error: error.message
        })
    }
}

module.exports = deleteNotification