/**
 * Below are routes for department-clud system
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

Router.get('/', auditSuccess('READ', 'departments'), list_all_departments)
Router.get('/search', auditSuccess('READ', 'departments'), search_department)
Router.get('/leader/:email', auditSuccess('READ', 'departments'), get_department_leader)
Router.get('/:department_id', auditSuccess('READ', 'departments'), get_department_by_id)
Router.get('/:departmentId/sub-departments', auditSuccess('READ', 'departments'), get_department_sub_departments)
Router.post('/', auditSuccess('CREATE', 'departments', (req, res, data) => `Created new department: ${data?.data?.department_name || req.body.department_name || 'unknown'}`), create_department)
Router.put('/:id', auditSuccess('UPDATE', 'departments', (req, res, data) => `Updated department: ${req.params.id}`), update_department)
Router.delete('/:id', auditSuccess('DELETE', 'departments', (req, res, data) => `Deleted department: ${req.params.id}`), delete_department)

// Add error logging middleware
Router.use(auditError('departments'))


module.exports = Router