const User = require('../../models/user')
const Notification = require('../../models/notification')
const { notifyUsers } = require('../../utilities/notify')
const { StatusCodes } = require('http-status-codes')
const jwt = require('jsonwebtoken')
const config = require('../../configurations/config')

/**
 * Server-to-server endpoint the DCS backend calls when an approver must act.
 * If the approver's email belongs to a registered account whose notifications
 * are on, the notification is persisted and delivered live (socket when the
 * user is online, web push otherwise). Approvers without an account only get
 * the DCS approval email - that is fine, delivered:false says why.
 */

// The caller proves itself with a JWT signed by the shared secret carrying { service: 'dcs' }.
const isValidServiceToken = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false
    try {
        const decoded = jwt.verify(authHeader.slice(7), config.jwtSecret || 'cok-jwt-secret-2026')
        return decoded && decoded.service === 'dcs'
    } catch (error) {
        return false
    }
}

const dcsApprovalNotification = async (req, res) => {
    try {
        if (!isValidServiceToken(req.headers.authorization)) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ status: false, message: 'Invalid service token' })
        }

        const { email, approver_name, form_name, link, message } = req.body || {}
        if (!email || !form_name || !link) {
            return res.status(StatusCodes.BAD_REQUEST).json({ status: false, message: 'email, form_name and link are required' })
        }

        const escaped = String(email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const user = await User.findOne({ email: { $regex: `^${escaped}$`, $options: 'i' } })
            .select('_id notifications_enabled')
            .lean()

        if (!user) {
            return res.status(StatusCodes.OK).json({ status: true, delivered: false, reason: 'no_account' })
        }
        if (user.notifications_enabled === false) {
            return res.status(StatusCodes.OK).json({ status: true, delivered: false, reason: 'notifications_off' })
        }

        const title = 'Approval requested'
        const body = message
            ? `A response submitted to ${form_name} is waiting for your approval. Message for you: ${message}`
            : `A response submitted to ${form_name} is waiting for your approval.`

        await new Notification({ user: user._id, type: 'approval_request', title, message: body, link }).save()

        await notifyUsers({
            event: 'dcs_approval_requested',
            to: [user._id],
            type: 'info',
            title,
            message: body,
            data: { link, link_label: 'View and approve' },
            url: link,
        })

        return res.status(StatusCodes.OK).json({ status: true, delivered: true })
    } catch (error) {
        console.error('DCS approval notification error:', error)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

module.exports = dcsApprovalNotification
