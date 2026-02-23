/**
 * Below are routes for service delivary system
 */

const Router = require('express').Router()

// Parfait's controllers

const assign_vistor_to_department = require('../../controllers/serivice_delivery/assign_vistor_to_department.js')
const get_vistor_by_id = require('../../controllers/serivice_delivery/get_vistor_by_id.js')
const list_vistors = require('../../controllers/serivice_delivery/list_vistors.js')
const search_vistor = require('../../controllers/serivice_delivery/search_vistor.js')
const vistor_checkin = require('../../controllers/serivice_delivery/vistor_checkin.js')
const vistor_checkout =  require('../../controllers/serivice_delivery/vistor_checkout.js')
const toggle_service_status = require('../../controllers/serivice_delivery/toggle_service_status.js')
const toggle_leave_out_side_and_return = require('../../controllers/serivice_delivery/toggle_leave_out_side_and_return.js')
const multer = require('multer')
const upload = multer()


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

Router.get('/visitor',list_vistors)
Router.get('/visitor/search', search_vistor)
Router.get('/visitor/:id', get_vistor_by_id)
Router.post('/visitor/checkin', vistor_checkin)
Router.post('/visitor/assign', assign_vistor_to_department)
Router.post('/visitor/checkout', vistor_checkout)
Router.post('/visitor/service/status', toggle_service_status)
Router.post('/visitor/emergency/leave-return', toggle_leave_out_side_and_return)

module.exports = Router