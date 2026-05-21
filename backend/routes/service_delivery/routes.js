/**
 * Below are routes for service delivary system
 */

const Router = require('express').Router()

// Import audit logging middleware
const { auditSuccess, auditError, auditUserActions } = require('../../middlewares/audit')

// Parfait's controllers

const assign_vistor_to_department = require('../../controllers/serivice_delivery/assign_vistor_to_department.js')
const get_vistor_by_id = require('../../controllers/serivice_delivery/get_vistor_by_id.js')
const list_vistors = require('../../controllers/serivice_delivery/list_vistors.js')
const search_vistor = require('../../controllers/serivice_delivery/search_vistor.js')
const vistor_checkin = require('../../controllers/serivice_delivery/vistor_checkin.js')
const vistor_checkout =  require('../../controllers/serivice_delivery/vistor_checkout.js')
const toggle_service_status = require('../../controllers/serivice_delivery/toggle_service_status.js')
const toggle_leave_out_side_and_return = require('../../controllers/serivice_delivery/toggle_leave_out_side_and_return.js')
const update_vistor_data = require('../../controllers/serivice_delivery/update_vistor_data.js')
const get_visitors_by_department = require('../../controllers/serivice_delivery/get_visitors_by_department_current.js')
const get_visitors_by_department_current = require('../../controllers/serivice_delivery/get_visitors_by_department_current.js')
const get_visitors_by_provider_current = require('../../controllers/serivice_delivery/get_visitors_by_provider_current.js')
const get_visitors_by_provider = require('../../controllers/serivice_delivery/get_visitors_by_provider_current.js')
const get_active_tasks = require('../../controllers/serivice_delivery/get_active_tasks.js')
const multer = require('multer')
const upload = multer()
// 👉 FIXED PATH: Matches colleague's exact folder spelling
const update_service_status = require('../../controllers/serivice_delivery/update_service_status.js');

Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 * This prevents the app from throwing a 500 error when:
 * - No data is sent
 * - Input is not formatted correctly as multipart/form-data
 * - Unexpected fields are sent
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        // Log the issue internally for the dev
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)

        // Instead of crashing, we normalize the body to an empty object
        // and let the request continue to the controllers
        req.body = req.body || {}
        return next()
    }
    next()
})



/**
 * Initial testing routes
 */

Router.get('/', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "GET service-delivery"
    })
})

Router.post('/', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "POST service-delivery"
    })
})


Router.put('/', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "PUT service-delivery"
    })
})


Router.delete('/', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "DELETE service-delivery"
    })
})


// Parfait's routes

Router.get('/visitor', auditSuccess('READ', 'visitors'), list_vistors)
Router.get('/visitor/search', auditSuccess('READ', 'visitors'), search_vistor)
Router.get('/visitor/active-tasks', auditSuccess('READ', 'visitors'), get_active_tasks)
Router.get('/visitor/by-department', auditSuccess('READ', 'visitors'), get_visitors_by_department)
Router.get('/visitor/by-department-current/:id', auditSuccess('READ', 'visitors'), get_visitors_by_department_current)
Router.get('/visitor/by-provider-current/:id', auditSuccess('READ', 'visitors'), get_visitors_by_provider_current)
Router.get('/visitor/by-provider', auditSuccess('READ', 'visitors'), get_visitors_by_provider)
Router.get('/visitor/:id', auditSuccess('READ', 'visitors'), get_vistor_by_id)
Router.put('/visitor/:id',
  auditSuccess('UPDATE', 'visitors', auditUserActions.updateVisitor),
  update_vistor_data
)
Router.post('/visitor/checkin',
  auditSuccess('CREATE', 'visitors', auditUserActions.createVisitor),
  vistor_checkin
)
Router.post('/visitor/assign',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Assigned visitor ${req.body.visitorId || 'unknown'} to department`),
  assign_vistor_to_department
)
Router.post('/visitor/checkout',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Checked out visitor ${req.body.visitorId || 'unknown'}`),
  vistor_checkout
)
Router.post('/visitor/service/status',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Updated service status for visitor ${req.body.visitorId || 'unknown'}`),
  toggle_service_status
)
Router.post('/visitor/emergency/leave-return',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Emergency leave/return for visitor ${req.body.visitorId || 'unknown'}`),
  toggle_leave_out_side_and_return
)

// Below route addeed by Fabrice and from now disabled due to conflicts his message was `Add your new dedicated route`
Router.put('/visitor/:id/status',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Updated service status for visitor ${req.params.id}`),
  update_service_status
)

// Add error logging middleware
Router.use(auditError('service_delivery'))

module.exports = Router