const Notification = require('../../models/notification')
const { StatusCodes } = require('http-status-codes')

const createNotification = async (req, res) => {
    try {
        const { user, task, type, title, message, scheduledFor } = req.body

        if (!user || !task || !type || !title || !message) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'User, task, type, title, and message are required'
            })
        }

        const validTypes = ['deadline_reminder', 'task_completed', 'subtask_completed']
        if (!validTypes.includes(type)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid notification type'
            })
        }

        const newNotification = new Notification({
            user,
            task,
            type,
            title,
            message,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : null
        })

        const savedNotification = await newNotification.save()

        res.status(StatusCodes.CREATED).json({
            status: true,
            message: 'Notification created successfully',
            data: savedNotification
        })

    } catch (error) {
        console.error('Error creating notification:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to create notification',
            error: error.message
        })
    }
}

module.exports = createNotification