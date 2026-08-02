/**
 * Below are routes for service delivery system
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
const get_visitors_by_department_current = require('../../controllers/serivice_delivery/get_visitors_by_department_current.js')
const get_visitors_by_provider_current = require('../../controllers/serivice_delivery/get_visitors_by_provider_current.js')
const get_active_tasks = require('../../controllers/serivice_delivery/get_active_tasks.js')
const multer = require('multer')
const upload = multer()
const update_service_status = require('../../controllers/serivice_delivery/update_service_status.js');
const dashboard_visitors = require('../../controllers/serivice_delivery/dashboard_visitors.js');
const service_tracking_visitors = require('../../controllers/serivice_delivery/service_tracking_visitors.js');
const assigned_visitors = require('../../controllers/serivice_delivery/assigned_visitors.js');

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
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)
        req.body = req.body || {}
        return next()
    }
    next()
})

/**
 * @swagger
 * /servicedelivery/visitor:
 *   get:
 *     summary: "List all visitors"
 *     description: "Retrieve a paginated list of all visitors. Supports filtering by in-house status. Role-based: Employees see only their assigned visitors, Head of Department sees department visitors, Admin sees all."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: in_house
 *         schema:
 *           type: boolean
 *         description: "Filter by in-house status (true = currently inside, false = checked out)"
 *         example: true
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
 *           default: 20
 *         description: "Number of records per page"
 *         example: 20
 *     responses:
 *       200:
 *         description: List of visitors retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 type:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Visitors retrieved successfully"
 *                 total:
 *                   type: integer
 *                   example: 150
 *                 page:
 *                   type: integer
 *                   example: 1
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
 *                         example: "Uwimana Jean Baptiste"
 *                       telephone:
 *                         type: string
 *                         example: "+250788123456"
 *                       email:
 *                         type: string
 *                         example: "jean.baptiste@example.com"
 *                       is_still_inhouse:
 *                         type: boolean
 *                         example: true
 *                       entry_date:
 *                         type: string
 *                         format: date-time
 *                       departments_assigned:
 *                         type: array
 *                         items:
 *                           type: object
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor', auditSuccess('READ', 'visitors'), list_vistors)

/**
 * @swagger
 * /servicedelivery/dashboard/visitors:
 *   get:
 *     summary: "Get dashboard visitors (unassigned)"
 *     description: "Returns visitors assigned to the current user for the dashboard view without manual frontend filtering"
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 20
 *     responses:
 *       200:
 *         description: Dashboard visitors results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                       telephone:
 *                         type: string
 *                       email:
 *                         type: string
 *                       status:
 *                         type: string
 *                       departments_assigned:
 *                         type: array
 *                       current_duration:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
Router.get('/dashboard/visitors', auditSuccess('READ', 'visitors'), dashboard_visitors)

/**
 * @swagger
 * /servicedelivery/service-tracking/visitors:
 *   get:
 *     summary: "Get service tracking visitors (assigned)"
 *     description: "Returns assigned visitors for the service tracking view without manual frontend filtering"
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 20
 *     responses:
 *       200:
 *         description: Service tracking visitors results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                       telephone:
 *                         type: string
 *                       email:
 *                         type: string
 *                       status:
 *                         type: string
 *                       departments_assigned:
 *                         type: array
 *                       current_duration:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
Router.get('/service-tracking/visitors', auditSuccess('READ', 'visitors'), service_tracking_visitors)

/**
 * @swagger
 * /servicedelivery/assigned-visitors:
 *   get:
 *     summary: "Get assigned visitors"
 *     description: "Get visitors assigned to the current user's department with search support"
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Assigned visitors results"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 type:
 *                   type: string
 *                 message:
 *                   type: string
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */
Router.get('/assigned-visitors', auditSuccess('READ', 'visitors'), assigned_visitors)

/**
 * @swagger
 * /servicedelivery/visitor/search:
 *   get:
 *     summary: "Search visitors"
 *     description: "Search visitors by name, telephone, identification number, plate number, badge number, or provider name. Supports pagination and in-house filtering."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: "Search keyword (searches across full_name, telephone, identification.number, plate_number, badge_number, provider_name)"
 *         example: "Uwimana"
 *       - in: query
 *         name: in_house
 *         schema:
 *           type: boolean
 *         description: "Filter by in-house status"
 *         example: true
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
 *           default: 20
 *           maximum: 20
 *         example: 20
 *     responses:
 *       200:
 *         description: Search results
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
 *                   example: "Search results"
 *                 total:
 *                   type: integer
 *                   example: 5
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor/search', auditSuccess('READ', 'visitors'), search_vistor)

/**
 * @swagger
 * /servicedelivery/visitor/active-tasks:
 *   get:
 *     summary: "Get active tasks for the current user"
 *     description: "Retrieve active service tasks assigned to the authenticated provider. Returns visitors currently being served."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Active tasks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor/active-tasks', auditSuccess('READ', 'visitors'), get_active_tasks)

/**
 * @swagger
 * /servicedelivery/visitor/by-department:
 *   get:
 *     summary: "Get visitors by department"
 *     description: "Retrieve visitors assigned to a specific department with pagination. Department is determined from the authenticated user's department."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Visitors by department retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor/by-department', auditSuccess('READ', 'visitors'), get_visitors_by_department_current)

/**
 * @swagger
 * /servicedelivery/visitor/by-department-current/{id}:
 *   get:
 *     summary: "Get current visitors by department ID"
 *     description: "Retrieve currently in-house visitors for a specific department."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Department ID"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Current visitors retrieved successfully
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor/by-department-current/:id', auditSuccess('READ', 'visitors'), get_visitors_by_department_current)

/**
 * @swagger
 * /servicedelivery/visitor/by-provider-current/{id}:
 *   get:
 *     summary: "Get current visitors by provider ID"
 *     description: "Retrieve currently in-house visitors assigned to a specific service provider."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Provider's User ID"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Current visitors for provider retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor/by-provider-current/:id', auditSuccess('READ', 'visitors'), get_visitors_by_provider_current)

/**
 * @swagger
 * /servicedelivery/visitor/by-provider:
 *   get:
 *     summary: "Get visitors by provider"
 *     description: "Retrieve visitors assigned to the authenticated provider with pagination."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Visitors by provider retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor/by-provider', auditSuccess('READ', 'visitors'), get_visitors_by_provider_current)

/**
 * @swagger
 * /servicedelivery/visitor/{id}:
 *   get:
 *     summary: "Get visitor by ID"
 *     description: "Retrieve a single visitor's complete details by their MongoDB ID."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Visitor's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Visitor details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 type:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Visitor details"
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Visitor not found
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor/:id', auditSuccess('READ', 'visitors'), get_vistor_by_id)

/**
 * @swagger
 * /servicedelivery/visitor/{id}:
 *   put:
 *     summary: "Update visitor data"
 *     description: "Update an existing visitor's information including personal details, vehicle storage, items, and notes."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Visitor's MongoDB ObjectId"
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
 *                 example: "Uwimana Jean Baptiste"
 *               telephone:
 *                 type: string
 *                 example: "+250788123456"
 *               email:
 *                 type: string
 *                 example: "jean.baptiste@example.com"
 *               gender:
 *                 type: string
 *                 example: "Male"
 *               badge_number:
 *                 type: string
 *                 example: "VIP-001"
 *               items_entered_with:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     item_name:
 *                       type: string
 *                       example: "Laptop"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *               vehicle_storage:
 *                 type: object
 *                 properties:
 *                   has_vehicle:
 *                     type: boolean
 *                 notes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       writter_name:
 *                         type: string
 *                         example: "Jean Pierre"
 *                       message:
 *                         type: string
 *                         example: "Visitor is waiting in lobby"
 *     responses:
 *       200:
 *         description: Visitor updated successfully
 *       400:
 *         description: Invalid ID or validation error
 *       404:
 *         description: Visitor not found
 *       500:
 *         description: Internal server error
 */
Router.put('/visitor/:id',
  auditSuccess('UPDATE', 'visitors', auditUserActions.updateVisitor),
  update_vistor_data
)

/**
 * @swagger
 * /servicedelivery/visitor/checkin:
 *   post:
 *     summary: "Check in a visitor"
 *     description: "Register a new visitor at the entrance. Creates a visitor record with personal details, identification, vehicle information, and items. Optionally stores vehicle details for parking integration."
 *     tags: [Service Delivery]
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
 *               - telephone
 *             properties:
 *               full_name:
 *                 type: string
 *                 description: "Visitor's full name"
 *                 example: "Mukamana Alice"
 *               telephone:
 *                 type: string
 *                 description: "Visitor's phone number"
 *                 example: "+250788123456"
 *               email:
 *                 type: string
 *                 description: "Visitor's email address"
 *                 example: "alice.mukamana@example.com"
 *               gender:
 *                 type: string
 *                 description: "Visitor's gender"
 *                 enum: [Male, Female, Not Specified]
 *                 example: "Female"
 *               badge_number:
 *                 type: string
 *                 description: "Visitor badge number"
 *                 example: "VST-2026-001"
 *               identification:
 *                 type: object
 *                 properties:
 *                   id_type:
 *                     type: string
 *                     example: "National ID"
 *                   number:
 *                     type: string
 *                     example: "1199880077881122"
 *               vehicle_storage:
 *                 type: object
 *                 properties:
 *                   has_vehicle:
 *                     type: boolean
 *                     description: "Whether visitor came with a vehicle"
 *                     example: false
 *                   vehicle_details:
 *                     type: object
 *                     properties:
 *                       plate_number:
 *                         type: string
 *                         example: "RAA 123B"
 *               items_entered_with:
 *                 type: array
 *                 description: "Items the visitor brought in"
 *                 items:
 *                   type: object
 *                   properties:
 *                     item_name:
 *                       type: string
 *                       example: "Laptop Bag"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       201:
 *         description: Visitor checked in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 type:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Visitor checked in successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: "Missing required fields (full_name, telephone)"
 *       409:
 *         description: "Visitor already checked in or badge number in use"
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/checkin',
  auditSuccess('CREATE', 'visitors', auditUserActions.createVisitor),
  vistor_checkin
)

/**
 * @swagger
 * /servicedelivery/visitor/assign:
 *   post:
 *     summary: "Assign visitor to department"
 *     description: "Assign a checked-in visitor to a department for service. The provider (authenticated user) gets assigned to handle the visitor."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visitorId
 *             properties:
 *               visitorId:
 *                 type: string
 *                 description: "Visitor's MongoDB ObjectId"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               assigned_by:
 *                 type: string
 *                 description: "User ID of person assigning"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Visitor assigned to department successfully
 *       400:
 *         description: Missing visitorId or validation error
 *       404:
 *         description: Visitor not found
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/assign',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Assigned visitor ${req.body.visitorId || 'unknown'} to department`),
  assign_vistor_to_department
)

/**
 * @swagger
 * /servicedelivery/visitor/checkout:
 *   post:
 *     summary: "Check out a visitor"
 *     description: "Check out a visitor when they leave the premises. Records exit time, items exited with, and finalizes their visit."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visitorId
 *             properties:
 *               visitorId:
 *                 type: string
 *                 description: "Visitor's MongoDB ObjectId"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               items_exited_with:
 *                 type: array
 *                 description: "Items the visitor is leaving with"
 *                 items:
 *                   type: object
 *                   properties:
 *                     item_name:
 *                       type: string
 *                       example: "Laptop Bag"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     description:
 *                       type: string
 *                       example: "Same as entered"
 *     responses:
 *       200:
 *         description: Visitor checked out successfully
 *       400:
 *         description: Missing visitorId
 *       404:
 *         description: Visitor not found
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/checkout',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Checked out visitor ${req.body.visitorId || 'unknown'}`),
  vistor_checkout
)

/**
 * @swagger
 * /servicedelivery/visitor/service/status:
 *   post:
 *     summary: "Toggle service status"
 *     description: "Update the service status for a visitor's assigned department. Status can be: Not started, Inprogress, Transfered, Completed."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visitorId
 *               - status
 *             properties:
 *               visitorId:
 *                 type: string
 *                 description: "Visitor's MongoDB ObjectId"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               status:
 *                 type: string
 *                 description: "New service status"
 *                 enum: [Not started, Inprogress, Transfered, Completed]
 *                 example: "Completed"
 *     responses:
 *       200:
 *         description: Service status updated successfully
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Visitor not found
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/service/status',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Updated service status for visitor ${req.body.visitorId || 'unknown'}`),
  toggle_service_status
)

/**
 * @swagger
 * /servicedelivery/visitor/emergency/leave-return:
 *   post:
 *     summary: "Toggle emergency leave and return"
 *     description: "Mark a visitor as temporarily leaving outside (emergency) and later returning. Tracks the duration of absence."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visitorId
 *             properties:
 *               visitorId:
 *                 type: string
 *                 description: "Visitor's MongoDB ObjectId"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               action:
 *                 type: string
 *                 description: "Action to perform"
 *                 enum: [leave, return]
 *                 example: "leave"
 *               type_of_emergency:
 *                 type: string
 *                 description: "Type of emergency"
 *                 enum: [Leave outside, Other]
 *                 example: "Leave outside"
 *     responses:
 *       200:
 *         description: Emergency status updated successfully
 *       400:
 *         description: Missing visitorId
 *       404:
 *         description: Visitor not found
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/emergency/leave-return',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Emergency leave/return for visitor ${req.body.visitorId || 'unknown'}`),
  toggle_leave_out_side_and_return
)

/**
 * @swagger
 * /servicedelivery/visitor/{id}/status:
 *   put:
 *     summary: "Update visitor service status by ID"
 *     description: "Update the service status for a visitor using their ID in the URL path."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Visitor's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: "Service status to set"
 *                 example: "Completed"
 *     responses:
 *       200:
 *         description: Service status updated
 *       404:
 *         description: Visitor not found
 *       500:
 *         description: Internal server error
 */
Router.put('/visitor/:id/status',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Updated service status for visitor ${req.params.id}`),
  update_service_status
)

// Add error logging middleware
Router.use(auditError('service_delivery'))

module.exports = Router