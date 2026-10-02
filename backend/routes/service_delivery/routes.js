/**
 * Below are routes for service delivery system
 */

const Router = require('express').Router()

// Import audit logging middleware
const { auditSuccess, auditError, auditUserActions } = require('../../middlewares/audit')

// Parfait's controllers
const assign_vistor_to_department = require('../../controllers/serivice_delivery/assign_vistor_to_department.js')
const get_vistor_by_id = require('../../controllers/serivice_delivery/get_vistor_by_id.js')
const get_visitor_by_identification = require('../../controllers/serivice_delivery/get_visitor_by_identification.js')
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
const assigned_visitors_gender_stats = require('../../controllers/serivice_delivery/assigned_visitors_gender_stats.js');
const served_visitors_gender_stats = require('../../controllers/serivice_delivery/served_visitors_gender_stats.js');
const export_visitors = require('../../controllers/serivice_delivery/export_visitors.js');
const queue_summary = require('../../controllers/serivice_delivery/queue_summary.js');
const partial_exit = require('../../controllers/serivice_delivery/partial_exit.js');
const return_visitor = require('../../controllers/serivice_delivery/return_visitor.js');

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
 * components:
 *   schemas:
 *     VisitorIdentification:
 *       type: object
 *       description: "Optional. Without an ID number the telephone identifies the visitor. id_type defaults to National ID"
 *       required:
 *         - number
 *       properties:
 *         id_type:
 *           type: string
 *           enum: [National ID, Passport, Driving Licence]
 *           description: "The older names NID and Driving Permit are accepted and saved as National ID and Driving Licence"
 *           example: "National ID"
 *         number:
 *           type: string
 *           description: "Unique: one visitor per ID number. Saved in upper case without spaces"
 *           example: "1199080012345678"
 *     VisitorDetailsInput:
 *       type: object
 *       description: "The person. It is saved once in the visitors collection; visits and parking sessions only keep a reference to it. identification can also be sent as the flat fields id_type and id_number."
 *       required:
 *         - full_name
 *         - telephone
 *       properties:
 *         full_name:
 *           type: string
 *           example: "Alice Uwase"
 *         telephone:
 *           type: string
 *           description: "Unique. Rwandan numbers typed in any form (+250 788 123 456, 250788123456, 788123456) are saved as 07XXXXXXXX"
 *           example: "0788123456"
 *         email:
 *           type: string
 *           format: email
 *           description: "Optional. Unique when given, saved in lower case"
 *           example: "alice@example.com"
 *         gender:
 *           type: string
 *           enum: [Male, Female]
 *           description: "Optional. Any other value (Not specified) is saved as no gender"
 *           example: "Female"
 *         identification:
 *           $ref: '#/components/schemas/VisitorIdentification'
 *     VisitorRecord:
 *       type: object
 *       description: "A registered person"
 *       properties:
 *         _id:
 *           type: string
 *           nullable: true
 *           description: "Visitor id. Null only on records of the old structure, which have no visitor"
 *           example: "66f1a2b3c4d5e6f7a8b9c0d1"
 *         identification:
 *           $ref: '#/components/schemas/VisitorIdentification'
 *         full_name:
 *           type: string
 *           example: "Alice Uwase"
 *         telephone:
 *           type: string
 *           example: "0788123456"
 *         email:
 *           type: string
 *           example: "alice@example.com"
 *         gender:
 *           type: string
 *           example: "Female"
 *         Is_In_House:
 *           type: boolean
 *           description: "True while the visitor has an open visit"
 *         N_visits:
 *           type: integer
 *           description: "How many times the visitor came (a staff car check-in counts too)"
 *           example: 3
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     VisitServer:
 *       type: object
 *       nullable: true
 *       description: "Who is serving the visitor right now (null when nobody is)"
 *       properties:
 *         user_id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Eric Employee"
 *         email:
 *           type: string
 *         department_id:
 *           type: string
 *         department_name:
 *           type: string
 *           example: "Lands"
 *         started_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     VisitView:
 *       type: object
 *       description: "A visit with its visitor. full_name, telephone, email, gender, identification, N_visits and Is_In_House are copied from the visitor, so screens that read them keep working."
 *       properties:
 *         _id:
 *           type: string
 *           description: "Visit id"
 *           example: "66f1a2b3c4d5e6f7a8b9c0e2"
 *         visitor:
 *           $ref: '#/components/schemas/VisitorRecord'
 *         visitor_id:
 *           type: string
 *           nullable: true
 *           example: "66f1a2b3c4d5e6f7a8b9c0d1"
 *         full_name:
 *           type: string
 *           example: "Alice Uwase"
 *         telephone:
 *           type: string
 *           example: "0788123456"
 *         email:
 *           type: string
 *         gender:
 *           type: string
 *         identification:
 *           $ref: '#/components/schemas/VisitorIdentification'
 *         N_visits:
 *           type: integer
 *         Is_In_House:
 *           type: boolean
 *         is_still_inhouse:
 *           type: boolean
 *           description: "False once the visit is closed"
 *         marked_as_out:
 *           type: boolean
 *           description: "True while the visitor is outside and the visit is still open (partial exit)"
 *         is_being_served:
 *           type: boolean
 *         current_server:
 *           $ref: '#/components/schemas/VisitServer'
 *         serving_by:
 *           $ref: '#/components/schemas/VisitServer'
 *         entry_date:
 *           type: string
 *           format: date-time
 *         exist_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Exit time, set when the visit closes"
 *         registered_by:
 *           type: string
 *         vehicle_storage:
 *           type: object
 *           properties:
 *             has_vehicle:
 *               type: boolean
 *             parking_record:
 *               type: string
 *               nullable: true
 *               description: "Id of the linked parking session"
 *             vehicle_details:
 *               type: object
 *               properties:
 *                 plate_number:
 *                   type: string
 *                   example: "RAB555C"
 *                 entered_time:
 *                   type: string
 *                   format: date-time
 *                 exited_time:
 *                   type: string
 *                   format: date-time
 *                 duration:
 *                   type: string
 *                   example: "45 mins"
 *         departments_assigned:
 *           type: array
 *           description: "Newest first"
 *           items:
 *             type: object
 *             properties:
 *               department_id:
 *                 type: string
 *               department_name:
 *                 type: string
 *               assigned_time:
 *                 type: string
 *                 format: date-time
 *               reached_in:
 *                 type: boolean
 *               provider_id:
 *                 type: string
 *                 nullable: true
 *               provider_name:
 *                 type: string
 *         services_status:
 *           type: array
 *           description: "Newest first"
 *           items:
 *             type: object
 *             properties:
 *               department_id:
 *                 type: string
 *               department_name:
 *                 type: string
 *               provider_id:
 *                 type: string
 *                 nullable: true
 *               provider_name:
 *                 type: string
 *               s_type:
 *                 type: string
 *                 enum: [Not started, Inprogress, Transfered, Completed]
 *         durations:
 *           type: object
 *           description: "services_durations, emergency_durations and entry_and_leave_duration"
 *         items_entered_with:
 *           type: array
 *           items:
 *             type: object
 *         items_exited_with:
 *           type: array
 *           items:
 *             type: object
 *         notes:
 *           type: array
 *           items:
 *             type: object
 *         attachments_count:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     VisitResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         type:
 *           type: string
 *           example: "success"
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/VisitView'
 *     VisitorErrorResponse:
 *       type: object
 *       description: "Error body of the visitor and parking endpoints. Refusals are plain answers (no forbidden_resource), so screens show the message instead of logging the user out."
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         type:
 *           type: string
 *           example: "warning"
 *         message:
 *           type: string
 *           example: "Someone with this telephone is already registered (Alice Uwase)"
 *         code:
 *           type: string
 *           description: "Present when the refusal has a machine readable reason"
 *           enum: [VISITOR_INVALID, VISITOR_CONFLICT, ALREADY_IN_HOUSE, ALREADY_PARKED, ALREADY_CHECKED_OUT, CAR_STILL_PARKED, VISITOR_BEING_SERVED]
 *         field:
 *           type: string
 *           description: "The form field the message belongs to (VISITOR_INVALID, VISITOR_CONFLICT, ALREADY_PARKED)"
 *           example: "telephone"
 *         existing:
 *           type: object
 *           description: "VISITOR_CONFLICT: the visitor who already holds the value"
 *           properties:
 *             _id:
 *               type: string
 *             full_name:
 *               type: string
 *         errors:
 *           type: array
 *           description: "VISITOR_INVALID: every missing or invalid field"
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 *         visitor_id:
 *           type: string
 *           description: "ALREADY_IN_HOUSE: the visitor who is already in house"
 *         serving_by:
 *           $ref: '#/components/schemas/VisitServer'
 *         plate_number:
 *           type: string
 *           description: "CAR_STILL_PARKED: the plate of the car that is still parked"
 *         error:
 *           type: string
 *           description: "500 only: technical detail"
 *   requestBodies:
 *     VisitReferenceBody:
 *       required: true
 *       description: "Which visit to act on. Send visitor_id (or visit_id)."
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               visitor_id:
 *                 type: string
 *                 description: "The visit id (the _id of a visit row) or the visitor id. A visitor id selects that visitor's open visit."
 *                 example: "66f1a2b3c4d5e6f7a8b9c0e2"
 *               visit_id:
 *                 type: string
 *                 description: "Optional. A visit id, used instead of visitor_id when both are sent"
 */

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
Router.get('/queue-summary', auditSuccess('READ', 'visitors'), queue_summary)

/**
 * @swagger
 * /servicedelivery/assigned-visitors/gender-stats:
 *   get:
 *     summary: "Get assigned visitors gender stats"
 *     description: "Get gender-based statistics for visitors assigned by the current user"
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: month
 *         description: "Period filter (today, week, month, last_month, year, range)"
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: "Start date for custom range"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: "End date for custom range"
 *     responses:
 *       200:
 *         description: "Gender stats results"
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                       Male:
 *                         type: integer
 *                       Female:
 *                         type: integer
 *                       Other:
 *                         type: integer
 *                 period:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
Router.get('/assigned-visitors/gender-stats', auditSuccess('READ', 'visitors'), assigned_visitors_gender_stats)
Router.get('/served-visitors/gender-stats', auditSuccess('READ', 'visitors'), served_visitors_gender_stats)
Router.get('/visitors/export', auditSuccess('READ', 'visitors'), export_visitors)

/**
 * @swagger
 * /servicedelivery/visitor/search:
 *   get:
 *     summary: "Search visitors"
 *     description: "Search visits by the visitor's name, telephone, identification number or email (matched on the registered visitor), the plate number of the car they came with, or a provider name. Employees and heads of department only see visits of their departments. An empty query lists every visit. Supports pagination and in-house filtering."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: "Search keyword. Matched on the visitor (full_name, email, identification.number, and the telephone digits in any form), on vehicle_storage.vehicle_details.plate_number and on the provider names"
 *         example: "Uwase"
 *       - in: query
 *         name: in_house
 *         schema:
 *           type: string
 *           enum: ["true", "false", "all"]
 *           default: "true"
 *         description: "true = visitors in house (default), false = visits already closed, all = both"
 *         example: "true"
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
 *                 type:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Visitor search results"
 *                 total:
 *                   type: integer
 *                   example: 5
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 20
 *                 pages:
 *                   type: integer
 *                   example: 1
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/VisitView'
 *                       - type: object
 *                         properties:
 *                           current_duration:
 *                             type: string
 *                             description: "Time inside for visitors in house, else the saved duration"
 *                             example: "1h 15m"
 *                           current_duration_hours:
 *                             type: number
 *                             example: 1.25
 *                           is_near_limit:
 *                             type: boolean
 *                             description: "In house for 7 hours or more"
 *                           is_over_limit:
 *                             type: boolean
 *                             description: "In house for 8 hours or more"
 *       403:
 *         description: "A head of department who has no department of their own and leads none"
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
 * /servicedelivery/visitor/by/identification/gate:
 *   get:
 *     summary: "Find a registered visitor by ID number"
 *     description: "Returns the registered visitor (the person, not a visit) who holds this ID number, to pre-fill the check-in form. The telephone can be used instead of the ID number."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id_number
 *         schema:
 *           type: string
 *         description: "Identification number, in any spacing or case. Required unless telephone is sent"
 *         example: "1199 0800 1234 5678"
 *       - in: query
 *         name: telephone
 *         schema:
 *           type: string
 *         description: "Optional. Telephone in any form, used when id_number is not sent"
 *         example: "0788123456"
 *       - in: query
 *         name: id_type
 *         schema:
 *           type: string
 *         description: "Accepted for older callers and not needed: the ID number alone identifies the visitor"
 *         example: "National ID"
 *     responses:
 *       200:
 *         description: Visitor found
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
 *                   example: "Visitor found"
 *                 data:
 *                   $ref: '#/components/schemas/VisitorRecord'
 *       400:
 *         description: "Neither id_number nor telephone was sent"
 *       404:
 *         description: "No registered visitor holds this ID number"
 *       500:
 *         description: Internal server error
 */
Router.get('/visitor/by/identification/gate', auditSuccess('READ', 'visitors'), get_visitor_by_identification)

/**
 * @swagger
 * /servicedelivery/visitor/{id}:
 *   put:
 *     summary: "Update visitor details"
 *     description: "Updates the visitor (the person) behind a visit. Details can only be changed while the visitor is in house. Send the full details, as on check-in. A telephone, email or ID number that belongs to another visitor is refused. Emits visitor_updated when something changed. PUT /visitors/{id} does the same from the visitor panel."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Visit id, or visitor id (then the visitor's latest visit is used)"
 *         example: "66f1a2b3c4d5e6f7a8b9c0e2"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VisitorDetailsInput'
 *     responses:
 *       200:
 *         description: "Visitor updated (message Nothing changed when the values were already saved)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitResponse'
 *       400:
 *         description: "A required field is missing or invalid (code VISITOR_INVALID)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorErrorResponse'
 *       404:
 *         description: Visitor not found
 *       409:
 *         description: "The visitor is not in house, or a value belongs to another visitor (code VISITOR_CONFLICT)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorErrorResponse'
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
 *     description: "Registers the person, or updates the registered visitor, and opens their visit. The visitor is found by visitor_id when one is sent, else by the ID number; a telephone or email that belongs to another visitor is refused. When the visitor came by car (has_vehicle or a plate_number), the parking session is started and linked to the visit in the same request, so reception does not call the Smart Parking check-in. Emits visitor_checkedin and visitor_updated, plus car_checkedin when a car was registered."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/VisitorDetailsInput'
 *               - type: object
 *                 properties:
 *                   visitor_id:
 *                     type: string
 *                     description: "Optional. The registered visitor the form was filled from (a lookup result). Their details are updated with the submitted values."
 *                     example: "66f1a2b3c4d5e6f7a8b9c0d1"
 *                   has_vehicle:
 *                     type: boolean
 *                     description: "True when the visitor came by car. A plate_number alone also means a car."
 *                     example: true
 *                   plate_number:
 *                     type: string
 *                     description: "Needed with has_vehicle. Saved in upper case, letters and digits only. The older vehicle_storage.vehicle_details.plate_number field is still read."
 *                     example: "RAB 555 C"
 *                   items_entered_with:
 *                     type: array
 *                     description: "Items the visitor brought in"
 *                     items:
 *                       type: object
 *                       properties:
 *                         item_name:
 *                           type: string
 *                           example: "Laptop Bag"
 *                         quantity:
 *                           type: integer
 *                           example: 1
 *     responses:
 *       201:
 *         description: "Visitor checked in. visitor_created is true when a new visitor was registered."
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/VisitResponse'
 *                 - type: object
 *                   properties:
 *                     visitor_created:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: "A required field is missing or invalid (code VISITOR_INVALID, with field), the plate number is not valid, or visitor_id is not a valid id"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorErrorResponse'
 *       404:
 *         description: "visitor_id does not match a registered visitor"
 *       409:
 *         description: "The visitor is already in house (code ALREADY_IN_HOUSE), the car is already parked (code ALREADY_PARKED), or a telephone, email or ID number belongs to another visitor (code VISITOR_CONFLICT)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorErrorResponse'
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
 *     description: "Sends an in-house visitor to a department, optionally to one employee of it, and notifies the recipients (visitor_assigned). Refused while someone is serving the visitor. When the caller is an employee this is a transfer: their own running service and their department's pending entries are closed as Transfered first. Emits visitor_updated. POST /visitors/{id}/send-to-department and /visitors/{id}/transfer do the same from the visitor panel."
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
 *               - visitor_id
 *               - new_department_id
 *             properties:
 *               visitor_id:
 *                 type: string
 *                 description: "Visit id, or visitor id (then the visitor's open visit is used)"
 *                 example: "66f1a2b3c4d5e6f7a8b9c0e2"
 *               new_department_id:
 *                 type: string
 *                 description: "Target department or unit id"
 *                 example: "66f1a2b3c4d5e6f7a8b9c0f3"
 *               new_department_name:
 *                 type: string
 *                 description: "Optional. The saved department name is used when empty"
 *                 example: "Lands"
 *               provider_id:
 *                 type: string
 *                 nullable: true
 *                 description: "Optional. The employee of that department to send the visitor to"
 *               provider_name:
 *                 type: string
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 description: "Employees only. A note saved with the transfer"
 *     responses:
 *       200:
 *         description: Visitor assigned to the department
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitResponse'
 *       400:
 *         description: "visitor_id or new_department_id is missing, the department or employee id is not valid, or the department has no employees"
 *       404:
 *         description: "The visitor is not in house, or the department was not found"
 *       409:
 *         description: "Someone is serving the visitor (code VISITOR_BEING_SERVED, with serving_by)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorErrorResponse'
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/assign',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Assigned visitor ${req.body.visitor_id || 'unknown'} to department`),
  assign_vistor_to_department
)

/**
 * @swagger
 * /servicedelivery/visitor/checkout:
 *   post:
 *     summary: "Check out a visitor"
 *     description: "Closes the visit of a visitor who leaves on foot: a running service is stopped (its provider gets you_forgot_to_stop_service), the exit time and the visit duration are saved, and the visitor is no longer in house. Refused while the car the visitor came with is still parked; the vehicle checkout closes that visit. Emits visitor_checkedout and visitor_updated."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       $ref: '#/components/requestBodies/VisitReferenceBody'
 *     responses:
 *       200:
 *         description: Visitor checked out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitResponse'
 *       400:
 *         description: "visitor_id is missing"
 *       404:
 *         description: Visitor not found or already checked out
 *       409:
 *         description: "The visitor's car is still parked (code CAR_STILL_PARKED, with plate_number)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorErrorResponse'
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/checkout',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Checked out visitor ${req.body.visitor_id || 'unknown'}`),
  vistor_checkout
)

/**
 * @swagger
 * /servicedelivery/visitor/partial-exit:
 *   post:
 *     summary: "Partial exit - the visitor walks out to their car"
 *     description: "When the car the visitor came with is still parked, the visit stays open and is marked as out (marked_as_out true) until the car leaves through the vehicle exit. Without a parked car this is a full checkout (checked_out true, emits visitor_checkedout). Emits visitor_updated."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       $ref: '#/components/requestBodies/VisitReferenceBody'
 *     responses:
 *       200:
 *         description: "Visitor marked as outside (checked_out false, with the plate_number of the parked car), or checked out when no car is parked (checked_out true)"
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/VisitResponse'
 *                 - type: object
 *                   properties:
 *                     checked_out:
 *                       type: boolean
 *                       example: false
 *                     plate_number:
 *                       type: string
 *                       description: "Only when the visitor was marked as outside"
 *                       example: "RAB555C"
 *       400:
 *         description: "visitor_id is missing"
 *       404:
 *         description: Visitor not found or already checked out
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/partial-exit',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Visitor ${req.body.visitor_id || req.body.visit_id || 'unknown'} partial exit`),
  partial_exit
)

/**
 * @swagger
 * /servicedelivery/visitor/return-with-badge:
 *   post:
 *     summary: "Visitor came back inside (older path)"
 *     deprecated: true
 *     description: "Older name of POST /servicedelivery/visitor/return, kept for existing callers. Same body and same answers."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       $ref: '#/components/requestBodies/VisitReferenceBody'
 *     responses:
 *       200:
 *         description: Visitor marked as returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitResponse'
 *       400:
 *         description: "visitor_id is missing"
 *       404:
 *         description: Visitor not found or already checked out
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/return-with-badge',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Visitor ${req.body.visitor_id || 'unknown'} returned`),
  return_visitor
)

/**
 * @swagger
 * /servicedelivery/visitor/return:
 *   post:
 *     summary: "Visitor came back inside"
 *     description: "A visitor who was marked as out (partial exit) is back in house: marked_as_out becomes false and the visit continues. Emits visitor_updated."
 *     tags: [Service Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       $ref: '#/components/requestBodies/VisitReferenceBody'
 *     responses:
 *       200:
 *         description: Visitor marked as returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitResponse'
 *       400:
 *         description: "visitor_id is missing"
 *       404:
 *         description: Visitor not found or already checked out
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/return',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Visitor ${req.body.visitor_id || 'unknown'} returned`),
  return_visitor
)

/**
 * @swagger
 * /servicedelivery/visitor/service/status:
 *   post:
 *     summary: "Toggle service status"
 *     description: "Employees only. Inprogress starts serving the visitor: one person serves a visitor at a time, so it is refused while someone else is serving. The pending entry of the caller's department or unit is used, or a self-assignment is created when there is none. Completed ends the caller's own service: only the person serving can complete it, and the pending entries of other departments stay. Emits service_status_updated and visitor_updated. POST /visitors/{id}/serve and /visitors/{id}/complete do the same from the visitor panel."
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
 *               - visitor_id
 *               - status
 *             properties:
 *               visitor_id:
 *                 type: string
 *                 description: "Visit id, or visitor id (then the visitor's open visit is used)"
 *                 example: "66f1a2b3c4d5e6f7a8b9c0e2"
 *               status:
 *                 type: string
 *                 description: "Inprogress to start serving, Completed to end the service"
 *                 enum: [Inprogress, Completed]
 *                 example: "Inprogress"
 *               notes:
 *                 type: string
 *                 description: "Optional. Saved on the visit when completing"
 *                 example: "Helped with the title deed"
 *     responses:
 *       200:
 *         description: Service status changed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitResponse'
 *       400:
 *         description: "visitor_id or status is missing, or status is not Inprogress or Completed"
 *       403:
 *         description: "The caller is not an employee, or is not the person serving the visitor"
 *       404:
 *         description: "The visitor is not in house, or the caller has no department"
 *       409:
 *         description: "Someone else is serving the visitor (code VISITOR_BEING_SERVED, with serving_by), or nobody is serving when completing"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorErrorResponse'
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/service/status',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Updated service status for visitor ${req.body.visitor_id || 'unknown'}`),
  toggle_service_status
)

/**
 * @swagger
 * /servicedelivery/visitor/emergency/leave-return:
 *   post:
 *     summary: "Toggle emergency leave and return"
 *     description: "A visitor who came by car steps outside for a while (leave) and comes back (return). leave opens a Leave outside period and marks the visit as out; return closes it with its duration and marks the visit back in. Only for visits with a vehicle. Emits leave_return and visitor_updated."
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
 *               - visitor_id
 *               - action
 *             properties:
 *               visitor_id:
 *                 type: string
 *                 description: "Visit id, or visitor id (then the visitor's open visit is used). visit_id is also accepted."
 *                 example: "66f1a2b3c4d5e6f7a8b9c0e2"
 *               action:
 *                 type: string
 *                 description: "Action to perform"
 *                 enum: [leave, return]
 *                 example: "leave"
 *               items_exited_with:
 *                 type: array
 *                 description: "leave only. Items carried out"
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
 *               message:
 *                 type: string
 *                 description: "Optional note saved on the visit"
 *     responses:
 *       200:
 *         description: Leave or return recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitResponse'
 *       400:
 *         description: "visitor_id or action is missing or invalid, the visit has no vehicle, the visitor is already outside (leave) or is not outside (return)"
 *       404:
 *         description: "The visitor is not in house"
 *       500:
 *         description: Internal server error
 */
Router.post('/visitor/emergency/leave-return',
  auditSuccess('UPDATE', 'visitors', (req, res, data) => `Emergency leave/return for visitor ${req.body.visitor_id || 'unknown'}`),
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