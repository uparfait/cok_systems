/**
 * Below are routes for employee-clud system
 */

const Router = require('express').Router()

// Import audit logging middleware
const { auditSuccess, auditError } = require('../../middlewares/audit')

/**
 * import all routes
 */

const create_employee = require('../../controllers/employee_crud/create_employee.js')
const list_all_employees = require('../../controllers/employee_crud/get_all_employees.js')
const get_employee_by_id = require('../../controllers/employee_crud/get_employee_by_id.js')
const update_employee = require('../../controllers/employee_crud/update_employee.js')
const delete_employee = require('../../controllers/employee_crud/delete_employee.js')
const search_employees = require('../../controllers/employee_crud/search_employee.js')
const get_employees_by_department = require('../../controllers/employee_crud/get_employees_by_department.js')
// 👉 1. IMPORTED MY NEW STAFF VEHICLE CONTROLLER HERE
const { 
    registerSingleStaffCar, 
    bulkUploadStaffCars 
} = require('../../controllers/employee_crud/staffVehicleController.js')

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

Router.get('/', auditSuccess('READ', 'employees'), list_all_employees)
Router.get('/search', auditSuccess('READ', 'employees'), search_employees)
Router.get('/by-department', auditSuccess('READ', 'employees'), get_employees_by_department)
Router.get('/:id', auditSuccess('READ', 'employees'), get_employee_by_id)
Router.post('/', auditSuccess('CREATE', 'employees', (req, res, data) => `Created new employee: ${data?.data?.full_name || req.body.full_name || 'unknown'}`), create_employee)
// 👉 2. ADDED MY NEW VEHICLE ROUTES HERE
Router.post('/register-car', auditSuccess('CREATE', 'vehicles', (req, res, data) => `Registered staff vehicle: ${req.body.plate_number || 'unknown'}`), registerSingleStaffCar)
Router.post('/bulk-upload-cars', auditSuccess('CREATE', 'vehicles', (req, res, data) => `Bulk uploaded staff vehicles`), bulkUploadStaffCars)

Router.put('/:id', auditSuccess('UPDATE', 'employees', (req, res, data) => `Updated employee: ${req.params.id}`), update_employee)
Router.delete('/:id', auditSuccess('DELETE', 'employees', (req, res, data) => `Deleted employee: ${req.params.id}`), delete_employee)

// Add error logging middleware
Router.use(auditError('employees'))


module.exports = Router