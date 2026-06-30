/**
 * Below are routes for employee-crud system
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
const { 
    registerSingleStaffCar, 
    bulkUploadStaffCars 
} = require('../../controllers/employee_crud/staffVehicleController.js')

const multer = require('multer')
const upload = multer()

Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)
        req.body = req.body || {}
        return next()
    }
    next()
})

/**
 * @swagger
 * /employee/crud:
 *   get:
 *     summary: "List all employees"
 *     description: "Retrieve a paginated list of all employees with their department and role information."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Page number"
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: "Number of records per page"
 *         example: 20
 *     responses:
 *       200:
 *         description: List of employees retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Employees retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                       full_name:
 *                         type: string
 *                         example: "Muhire Jean Baptiste"
 *                       email:
 *                         type: string
 *                         example: "muhire.jean@cok.gov.rw"
 *                       telephone:
 *                         type: string
 *                         example: "+250788123456"
 *                       department:
 *                         type: object
 *                       roles:
 *                         type: object
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       500:
 *         description: Internal server error
 */
Router.get('/', auditSuccess('READ', 'employees'), list_all_employees)

/**
 * @swagger
 * /employee/crud:
 *   post:
 *     summary: "Create a new employee"
 *     description: "Create a new employee user account with personal details, department assignment, and role configuration."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - full_name
 *               - email
 *               - telephone
 *             properties:
 *               full_name:
 *                 type: string
 *                 description: "Employee's full name"
 *                 example: "Mukamana Alice"
 *               telephone:
 *                 type: string
 *                 description: "Phone number"
 *                 example: "+250788123456"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: "Email address"
 *                 example: "alice.mukamana@cok.gov.rw"
 *               identification:
 *                 type: object
 *                 properties:
 *                   id_type:
 *                     type: string
 *                     example: "National ID"
 *                   number:
 *                     type: string
 *                     example: "1199880077881122"
 *               gender:
 *                 type: string
 *                 enum: [Male, Female]
 *                 example: "Female"
 *               title:
 *                 type: string
 *                 example: "Ms."
 *               department_id:
 *                 type: string
 *                 description: "Department's MongoDB ObjectId"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               role_name:
 *                 type: string
 *                 description: "Role to assign"
 *                 example: "department_employee"
 *     responses:
 *       201:
 *         description: Employee created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Email or telephone already exists
 *       500:
 *         description: Internal server error
 */
Router.post('/', auditSuccess('CREATE', 'employees', (req, res, data) => `Created new employee: ${data?.data?.full_name || req.body.full_name || 'unknown'}`), create_employee)

/**
 * @swagger
 * /employee/crud/search:
 *   get:
 *     summary: "Search employees"
 *     description: "Search employees by full name, telephone, email, or title (case-insensitive)."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: "Search keyword"
 *         example: "Muhire"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         example: 10
 *     responses:
 *       200:
 *         description: Search results
 *       500:
 *         description: Internal server error
 */
Router.get('/search', auditSuccess('READ', 'employees'), search_employees)

/**
 * @swagger
 * /employee/crud/by-department:
 *   get:
 *     summary: "Get employees by department"
 *     description: "Retrieve employees filtered by department ID, department name, active status, or account activation status."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: string
 *         description: "Filter by department MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *       - in: query
 *         name: department_name
 *         schema:
 *           type: string
 *         description: "Filter by department name (partial match)"
 *         example: "Urbanisme"
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: "Filter by active status"
 *       - in: query
 *         name: is_account_activated
 *         schema:
 *           type: boolean
 *         description: "Filter by account activation status"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Employees retrieved successfully
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.get('/by-department', auditSuccess('READ', 'employees'), get_employees_by_department)

/**
 * @swagger
 * /employee/crud/{id}:
 *   get:
 *     summary: "Get employee by ID"
 *     description: "Retrieve a single employee's complete details by their MongoDB ObjectId."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Employee's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Employee details retrieved successfully
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
Router.get('/:id', auditSuccess('READ', 'employees'), get_employee_by_id)

/**
 * @swagger
 * /employee/crud/register-car:
 *   post:
 *     summary: "Register a staff vehicle"
 *     description: "Register a single staff vehicle with plate number, owner details, and department association."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plate_number
 *             properties:
 *               plate_number:
 *                 type: string
 *                 description: "Vehicle plate number"
 *                 example: "RAA 123B"
 *               owner_name:
 *                 type: string
 *                 description: "Vehicle owner's name"
 *                 example: "Muhire Jean Baptiste"
 *               department_name:
 *                 type: string
 *                 description: "Owner's department"
 *                 example: "Service d'Urbanisme"
 *               identification:
 *                 type: string
 *                 description: "Owner's identification number"
 *                 example: "1199880077881122"
 *     responses:
 *       201:
 *         description: Staff vehicle registered successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Vehicle already registered
 *       500:
 *         description: Internal server error
 */
Router.post('/register-car', auditSuccess('CREATE', 'vehicles', (req, res, data) => `Registered staff vehicle: ${req.body.plate_number || 'unknown'}`), registerSingleStaffCar)

/**
 * @swagger
 * /employee/crud/bulk-upload-cars:
 *   post:
 *     summary: "Bulk upload staff vehicles"
 *     description: "Upload an Excel or CSV file to bulk register staff vehicles."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "Excel (.xlsx, .xls) or CSV file with staff vehicle data"
 *     responses:
 *       200:
 *         description: Bulk upload processed successfully
 *       400:
 *         description: Invalid file format
 *       500:
 *         description: Internal server error
 */
Router.post('/bulk-upload-cars', auditSuccess('CREATE', 'vehicles', (req, res, data) => `Bulk uploaded staff vehicles`), bulkUploadStaffCars)

/**
 * @swagger
 * /employee/crud/{id}:
 *   put:
 *     summary: "Update employee"
 *     description: "Update an existing employee's personal details, department assignment, role, and account status."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Employee's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: "Muhire Jean Baptiste Updated"
 *               telephone:
 *                 type: string
 *                 example: "+250788123456"
 *               email:
 *                 type: string
 *                 example: "muhire.updated@cok.gov.rw"
 *               gender:
 *                 type: string
 *               title:
 *                 type: string
 *               department_id:
 *                 type: string
 *               role_name:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *       400:
 *         description: Invalid ObjectId or validation error
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id', auditSuccess('UPDATE', 'employees', (req, res, data) => `Updated employee: ${req.params.id}`), update_employee)

/**
 * @swagger
 * /employee/crud/{id}:
 *   delete:
 *     summary: "Delete employee"
 *     description: "Permanently delete an employee record by their MongoDB ObjectId."
 *     tags: [Employees]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Employee's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Employee deleted successfully
 *       400:
 *         description: Invalid ObjectId
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/:id', auditSuccess('DELETE', 'employees', (req, res, data) => `Deleted employee: ${req.params.id}`), delete_employee)

// Add error logging middleware
Router.use(auditError('employees'))

module.exports = Router