const User = require('../../models/user')
const { StatusCodes } = require('http-status-codes')

// Account-level notification switch (in-app + push, e.g. DCS approval requests).

const getNotificationSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('notifications_enabled').lean()
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ status: false, message: 'User not found' })
        }
        return res.status(StatusCodes.OK).json({
            status: true,
            data: { notifications_enabled: user.notifications_enabled !== false }
        })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

const updateNotificationSettings = async (req, res) => {
    try {
        const { notifications_enabled } = req.body || {}
        if (typeof notifications_enabled !== 'boolean') {
            return res.status(StatusCodes.BAD_REQUEST).json({ status: false, message: 'notifications_enabled must be true or false' })
        }
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { notifications_enabled },
            { new: true }
        ).select('notifications_enabled').lean()
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ status: false, message: 'User not found' })
        }
        return res.status(StatusCodes.OK).json({
            status: true,
            message: notifications_enabled ? 'Notifications enabled' : 'Notifications disabled',
            data: { notifications_enabled: user.notifications_enabled !== false }
        })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

module.exports = { getNotificationSettings, updateNotificationSettings }
