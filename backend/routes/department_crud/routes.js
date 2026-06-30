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
 */
Router.use((req, res, next) => {
    const multerError = req._multerError || null;
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        return next();
    }
    req.body = req.body || {};
    next();
})

// Global error handler specifically for multer errors
Router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.warn('[UPLOAD WARNING]: Handled multer error:', err.message)
        req.body = req.body || {}
        return next()
    }
    next(err)
})

/**
 * @swagger
 * /department/crud:
 *   get:
 *     summary: "List all departments"
 *     description: "Retrieve a paginated list of all departments. Returns departments with their leaders, services, sub-departments, and employee counts."
 *     tags: [Departments]
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
 *           default: 1000
 *         description: "Number of records per page"
 *         example: 20
 *     responses:
 *       200:
 *         description: List of departments retrieved successfully
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
 *                   example: "Departments retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                       name:
 *                         type: string
 *                         example: "Service d'Etat Civil"
 *                       department_id:
 *                         type: string
 *                         example: "DEPT-001"
 *                       description:
 *                         type: string
 *                         example: "Civil registration services"
 *                       leader:
 *                         type: object
 *                       total_employees:
 *                         type: integer
 *                         example: 25
 *                       room_number:
 *                         type: string
 *                         example: "Room 205, 2nd Floor"
 *                       services:
 *                         type: array
 *                         items:
 *                           type: object
 *                       sub_departments:
 *                         type: array
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       500:
 *         description: Internal server error
 */
Router.get('/', auditSuccess('READ', 'departments'), list_all_departments)

/**
 * @swagger
 * /department/crud:
 *   post:
 *     summary: "Create a new department"
 *     description: "Create a new department with name, ID, leader, and response time configuration."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - department_name
 *               - department_id
 *             properties:
 *               department_name:
 *                 type: string
 *                 description: "Department name"
 *                 example: "Service d'Urbanisme"
 *               department_id:
 *                 type: string
 *                 description: "Unique department identifier"
 *                 example: "DEPT-005"
 *               department_leader:
 *                 type: string
 *                 description: "Leader's email address"
 *                 example: "muhire.jean@cok.gov.rw"
 *               department_response_time_in_minutes:
 *                 type: integer
 *                 description: "Target response time in minutes"
 *                 example: 5
 *     responses:
 *       201:
 *         description: Department created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Department ID already exists
 *       500:
 *         description: Internal server error
 */
Router.post('/', auditSuccess('CREATE', 'departments', (req, res, data) => `Created new department: ${data?.data?.department_name || req.body.department_name || 'unknown'}`), create_department)

/**
 * @swagger
 * /department/crud/search:
 *   get:
 *     summary: "Search departments"
 *     description: "Search departments by name or department ID (case-insensitive regex search)."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: "Search keyword"
 *         example: "Urbanisme"
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
 *         description: Search results
 *       500:
 *         description: Internal server error
 */
Router.get('/search', auditSuccess('READ', 'departments'), search_department)

/**
 * @swagger
 * /department/crud/leader/{email}:
 *   get:
 *     summary: "Get departments by leader email"
 *     description: "Retrieve all departments managed by a leader identified by their email address."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: "Leader's email address"
 *         example: "muhire.jean@cok.gov.rw"
 *     responses:
 *       200:
 *         description: Departments retrieved successfully
 *       404:
 *         description: No departments found for this leader
 *       500:
 *         description: Internal server error
 */
Router.get('/leader/:email', auditSuccess('READ', 'departments'), get_department_leader)

/**
 * @swagger
 * /department/crud/{department_id}:
 *   get:
 *     summary: "Get department by department_id"
 *     description: "Retrieve a single department by its unique department_id string (not MongoDB _id)."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department_id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Department identifier (e.g., DEPT-001)"
 *         example: "DEPT-001"
 *     responses:
 *       200:
 *         description: Department details retrieved successfully
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.get('/:department_id', auditSuccess('READ', 'departments'), get_department_by_id)

/**
 * @swagger
 * /department/crud/{departmentId}/sub-departments:
 *   get:
 *     summary: "Get sub-departments"
 *     description: "Retrieve all sub-departments (units) under a parent department."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Parent department's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Sub-departments retrieved successfully
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.get('/:departmentId/sub-departments', auditSuccess('READ', 'departments'), get_department_sub_departments)

/**
 * @swagger
 * /department/crud/{id}:
 *   put:
 *     summary: "Update department"
 *     description: "Update a department's configuration including response time and leader assignment."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Department's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               department_name:
 *                 type: string
 *                 example: "Service d'Urbanisme"
 *               department_response_time_in_minutes:
 *                 type: integer
 *                 example: 5
 *               department_leader:
 *                 type: string
 *                 description: "Leader's email address"
 *                 example: "muhire.jean@cok.gov.rw"
 *     responses:
 *       200:
 *         description: Department updated successfully
 *       400:
 *         description: Invalid ObjectId or missing fields
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id', auditSuccess('UPDATE', 'departments', (req, res, data) => `Updated department: ${req.params.id}`), update_department)

/**
 * @swagger
 * /department/crud/{id}:
 *   delete:
 *     summary: "Delete department"
 *     description: "Delete a department by its MongoDB ObjectId."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Department's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Department deleted successfully
 *       400:
 *         description: Invalid ObjectId
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/:id', auditSuccess('DELETE', 'departments', (req, res, data) => `Deleted department: ${req.params.id}`), delete_department)

/**
 * @swagger
 * /department/crud/{departmentId}/services:
 *   post:
 *     summary: "Add service to department"
 *     description: "Add a new service offering to a department."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Department's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: "Service name"
 *                 example: "Permis de Construire"
 *               description:
 *                 type: string
 *                 description: "Service description"
 *                 example: "Building permit application and processing"
 *     responses:
 *       201:
 *         description: Service added successfully
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.post('/:departmentId/services', auditSuccess('CREATE', 'department_services', (req, res, data) => `Added service to department: ${req.params.departmentId}`), addService)

/**
 * @swagger
 * /department/crud/{departmentId}/services/{serviceId}:
 *   put:
 *     summary: "Update department service"
 *     description: "Update the name and description of a department service."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Permis de Construire Updated"
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Service updated successfully
 *       404:
 *         description: Department or service not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:departmentId/services/:serviceId', auditSuccess('UPDATE', 'department_services', (req, res, data) => `Updated service: ${req.params.serviceId}`), updateService)

/**
 * @swagger
 * /department/crud/{departmentId}/services/{serviceId}:
 *   delete:
 *     summary: "Delete department service"
 *     description: "Remove a service from a department."
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *       404:
 *         description: Department or service not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/:departmentId/services/:serviceId', auditSuccess('DELETE', 'department_services', (req, res, data) => `Deleted service: ${req.params.serviceId}`), deleteService)

// Add error logging middleware
Router.use(auditError('departments'))

module.exports = Router