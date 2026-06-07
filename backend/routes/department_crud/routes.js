/**
 * Below are routes for department-crud system
 */

const Router = require('express').Router()

// Import audit logging middleware
const { auditSuccess, auditError } = require('../../middlewares/audit')

/**
 * import all routes
 */

const create_department = require('../../controllers/department_crud/create_department.js')
const list_all_departments = require('../../controllers/department_crud/list_all_departments.js')
const get_department_by_id = require('../../controllers/department_crud/get_department_by_id.js')
const update_department = require('../../controllers/department_crud/update_department.js')
const delete_department = require('../../controllers/department_crud/delete_department.js')
const search_department = require('../../controllers/department_crud/search_department.js')
const get_department_leader = require('../../controllers/department_crud/get_department_leader.js')
const get_department_sub_departments = require('../../controllers/department_crud/get_department_sub_departments.js')
const { addService, updateService, deleteService } = require('../../controllers/department_crud/service_management.js')
const multer = require('multer')
const upload = multer()


Router.use(upload.any())


/**
 * Multer Error Handler / Normal Request Pass-through
 * This prevents the app from throwing a 500 error when:
 * - No data is sent
 * - Input is not formatted correctly as multipart/form-data
 * - Unexpected fields are sent
 * 
 * NOTE: A 3-parameter middleware is used here so Express treats it as a
 * NORMAL middleware (not an error handler). Multer errors are caught
 * inside the function body by checking the error type.
 */
Router.use((req, res, next) => {
    // If multer threw an error, it will be attached to the request
    const multerError = req._multerError || null;
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        // Body is fine, proceed
        return next();
    }
    // Normalize body if it's empty to prevent downstream crashes
    req.body = req.body || {};
    next();
})

// Global error handler specifically for multer errors that propagate here
Router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.warn('[UPLOAD WARNING]: Handled multer error:', err.message)
        req.body = req.body || {}
        return next()
    }
    // Not a multer error, pass to next error handler
    next(err)
})

Router.get('/', auditSuccess('READ', 'departments'), list_all_departments)
Router.get('/search', auditSuccess('READ', 'departments'), search_department)
Router.get('/leader/:email', auditSuccess('READ', 'departments'), get_department_leader)
Router.get('/:department_id', auditSuccess('READ', 'departments'), get_department_by_id)
Router.get('/:departmentId/sub-departments', auditSuccess('READ', 'departments'), get_department_sub_departments)
Router.post('/', auditSuccess('CREATE', 'departments', (req, res, data) => `Created new department: ${data?.data?.department_name || req.body.department_name || 'unknown'}`), create_department)
Router.put('/:id', auditSuccess('UPDATE', 'departments', (req, res, data) => `Updated department: ${req.params.id}`), update_department)
Router.delete('/:id', auditSuccess('DELETE', 'departments', (req, res, data) => `Deleted department: ${req.params.id}`), delete_department)

// Service management routes
Router.post('/:departmentId/services', auditSuccess('CREATE', 'department_services', (req, res, data) => `Added service to department: ${req.params.departmentId}`), addService)
Router.put('/:departmentId/services/:serviceId', auditSuccess('UPDATE', 'department_services', (req, res, data) => `Updated service: ${req.params.serviceId}`), updateService)
Router.delete('/:departmentId/services/:serviceId', auditSuccess('DELETE', 'department_services', (req, res, data) => `Deleted service: ${req.params.serviceId}`), deleteService)

// Add error logging middleware
Router.use(auditError('departments'))


module.exports = Router