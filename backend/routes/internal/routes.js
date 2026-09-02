/**
 * Server-to-server routes. Not behind the user `authenticate` middleware -
 * every controller here verifies its own service JWT (signed with the shared
 * JWT_SECRET and carrying a `service` claim) before doing anything.
 */

const Router = require('express').Router()

const dcsApprovalNotification = require('../../controllers/internal/dcs_approval_notification')

Router.post('/dcs/approval-notification', dcsApprovalNotification)

module.exports = Router
