/**
 * Below are routes for smartparking system
 */

const Router = require('express').Router()
const multer = require('multer');

// Import audit logging middleware
const { auditSuccess, auditError, auditUserActions } = require('../../middlewares/audit');

const { bulkUploadReservations, registerSingleReservation } = require('../../controllers/reservationController');
const { getAllReservations, createStaffBooking, cancelReservation, reactivateReservation, bulkUploadStaff, bulkCancelReservations, bulkDeleteReservations, getReservationBatches, cancelReservationBatch, rescheduleReservationBatch, deleteReservationBatch } = require('../../controllers/reservationsController');

// parfait's controllers
const check_in = require('../../controllers/smart_parking/check_in.js')
const check_out = require('../../controllers/smart_parking/check_out.js')
const get_parking_record_by_id = require('../../controllers/smart_parking/get_parking_record_by_id.js')
const list_flagged_cars = require('../../controllers/smart_parking/list_flagged_cars.js')
const list_parking = require('../../controllers/smart_parking/list_parking.js')
const search_inparking_records = require('../../controllers/smart_parking/search_inparking_records.js')
const verify_acar = require('../../controllers/smart_parking/verify_acar.js')
const get_parking_slots_number = require('../../controllers/smart_parking/get_parking_slots_number.js')
const update_parking_slots_config = require('../../controllers/smart_parking/update_parking_slots_config.js')

// 2. Configure Multer to store the uploaded Excel file in memory temporarily
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // Optional: limit file size to 5MB
    
    // FILTER EXCEL AND CSV FILES
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'application/csv',
            'application/octet-stream'
        ];
        
        if (allowedExtensions.includes(fileExtension) || allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            req.UploadError = {
                success: false,
                message: 'Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file (.csv).'
            }
            cb(null, true);
        }
    }
});

/**
 * @swagger
 * /smartparking/slots:
 *   get:
 *     summary: "Get parking slot configuration"
 *     description: "Retrieve the current parking slot configuration including total slots, available slots, and reserved slots for visitors, staff, and regular users."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Parking slot configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSlots:
 *                       type: integer
 *                       example: 350
 *                     visitorsReservedSlots:
 *                       type: integer
 *                       example: 50
 *                     staffReservedSlots:
 *                       type: integer
 *                       example: 100
 *                     visitorsAvailableSlots:
 *                       type: integer
 *                       example: 45
 *                     staffAvailableSlots:
 *                       type: integer
 *                       example: 85
 *                     RegularReservedSlots:
 *                       type: integer
 *                       example: 100
 *                     RegularAvailableSlots:
 *                       type: integer
 *                       example: 95
 *       500:
 *         description: Internal server error
 */
Router.get('/slots', get_parking_slots_number);

/**
 * @swagger
 * /smartparking/slots:
 *   put:
 *     summary: "Update parking slot configuration"
 *     description: "Update the parking slot configuration. Requires admin privileges."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalSlots:
 *                 type: integer
 *                 example: 400
 *               visitorsReservedSlots:
 *                 type: integer
 *                 example: 60
 *               staffReservedSlots:
 *                 type: integer
 *                 example: 120
 *               RegularReservedSlots:
 *                 type: integer
 *                 example: 120
 *     responses:
 *       200:
 *         description: Parking slot configuration updated successfully
 *       400:
 *         description: Invalid configuration values
 *       500:
 *         description: Internal server error
 */
Router.put('/slots', auditSuccess('UPDATE', 'parking_config', (req, res, data) => 'Updated parking slot configuration'), update_parking_slots_config);

/**
 * @swagger
 * /smartparking/reservations:
 *   get:
 *     summary: "Get all reservations"
 *     description: "Retrieve a list of all parking reservations with pagination and filtering."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, cancelled, completed]
 *         description: "Filter by reservation status"
 *     responses:
 *       200:
 *         description: Reservations retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/reservations', auditSuccess('READ', 'reservations'), getAllReservations);

/**
 * @swagger
 * /smartparking/staff-booking:
 *   post:
 *     summary: "Create staff parking booking"
 *     description: "Create a parking reservation for a staff member. Staff get priority parking allocation."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - plate_number
 *             properties:
 *               userId:
 *                 type: string
 *                 description: "Staff user ID"
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               plate_number:
 *                 type: string
 *                 description: "Vehicle plate number"
 *                 example: "RAA 123B"
 *     responses:
 *       201:
 *         description: Staff booking created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Staff already has an active booking
 *       500:
 *         description: Internal server error
 */
Router.post('/staff-booking',
  auditSuccess('CREATE', 'reservations', (req, res, data) => `Created staff parking reservation for ${req.body.userId || 'unknown user'}`),
  createStaffBooking
);

/**
 * @swagger
 * /smartparking/reservations/{id}/cancel:
 *   put:
 *     summary: "Cancel a reservation"
 *     description: "Cancel an existing parking reservation by its ID."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Reservation MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Reservation cancelled successfully
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Internal server error
 */
Router.put('/reservations/:id/cancel',
  auditSuccess('UPDATE', 'reservations', (req, res, data) => `Cancelled reservation ${req.params.id}`),
  cancelReservation
);

/**
 * @swagger
 * /smartparking/reservations/{id}/reactivate:
 *   put:
 *     summary: "Reactivate a cancelled reservation"
 *     description: "Reactivate a previously cancelled parking reservation."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Reservation MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Reservation reactivated successfully
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Internal server error
 */
Router.put('/reservations/:id/reactivate',
  auditSuccess('UPDATE', 'reservations', (req, res, data) => `Reactivated reservation ${req.params.id}`),
  reactivateReservation
);

/**
 * @swagger
 * /smartparking/reservations/bulk-cancel:
 *   post:
 *     summary: "Bulk cancel selected reservations"
 *     description: "Cancel several reservations at once. Body: { items: [{ id, type: 'visitor' | 'staff' }] }"
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Bulk cancel processed
 */
Router.post('/reservations/bulk-cancel',
  auditSuccess('UPDATE', 'reservations', (req, res, data) => `Bulk cancelled ${req.body?.items?.length || 0} reservations`),
  bulkCancelReservations
);

/**
 * @swagger
 * /smartparking/reservations/bulk-delete:
 *   post:
 *     summary: "Bulk delete selected reservations"
 *     description: "Permanently delete several reservations at once. Body: { items: [{ id, type: 'visitor' | 'staff' }] }"
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Bulk delete processed
 */
Router.post('/reservations/bulk-delete',
  auditSuccess('DELETE', 'reservations', (req, res, data) => `Bulk deleted ${req.body?.items?.length || 0} reservations`),
  bulkDeleteReservations
);

/**
 * @swagger
 * /smartparking/reservation-batches:
 *   get:
 *     summary: "List uploaded reservation batches"
 *     description: "Each bulk upload (visitor or staff) is a batch named after its file. Returns counts, window, and status per batch."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Batches listed
 */
Router.get('/reservation-batches', getReservationBatches);

/**
 * @swagger
 * /smartparking/reservation-batches/cancel:
 *   put:
 *     summary: "Cancel a whole uploaded batch"
 *     description: "Cancels every pending reservation in the batch. Body: { id, type: 'visitor' | 'staff' }"
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Batch cancelled
 */
Router.put('/reservation-batches/cancel',
  auditSuccess('UPDATE', 'reservations', (req, res, data) => `Cancelled reservation batch ${req.body?.id}`),
  cancelReservationBatch
);

/**
 * @swagger
 * /smartparking/reservation-batches/reschedule:
 *   put:
 *     summary: "Reschedule a whole uploaded batch"
 *     description: "Replaces Start/End dates for every not-yet-used reservation in the batch and revives cancelled/expired ones. Body: { id, type, start_date, end_date }"
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Batch rescheduled
 */
Router.put('/reservation-batches/reschedule',
  auditSuccess('UPDATE', 'reservations', (req, res, data) => `Rescheduled reservation batch ${req.body?.id}`),
  rescheduleReservationBatch
);

/**
 * @swagger
 * /smartparking/reservation-batches/delete:
 *   post:
 *     summary: "Permanently delete a whole uploaded batch"
 *     description: "Removes every reservation in the batch from the database. Body: { id, type: 'visitor' | 'staff' }"
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Batch deleted
 */
Router.post('/reservation-batches/delete',
  auditSuccess('DELETE', 'reservations', (req, res, data) => `Deleted reservation batch ${req.body?.id}`),
  deleteReservationBatch
);

/**
 * @swagger
 * /smartparking/bulk-staff-upload:
 *   post:
 *     summary: "Bulk upload staff reservations"
 *     description: "Upload an Excel or CSV file to bulk create staff parking reservations."
 *     tags: [Smart Parking]
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
 *                 description: "Excel (.xlsx, .xls) or CSV file with staff data"
 *     responses:
 *       200:
 *         description: Bulk upload processed successfully
 *       400:
 *         description: Invalid file format
 *       500:
 *         description: Internal server error
 */
Router.post('/bulk-staff-upload',
  auditSuccess('CREATE', 'reservations', (req, res, data) => `Bulk uploaded staff reservations`),
  upload.any(), bulkUploadStaff
);

/**
 * @swagger
 * /smartparking/vehicle:
 *   get:
 *     summary: "List parking records"
 *     description: "Retrieve a paginated list of parking records with optional status filtering."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed]
 *         description: "Filter by parking record status"
 *         example: "active"
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
 *         description: Parking records retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/vehicle', auditSuccess('READ', 'vehicles'), list_parking)

/**
 * @swagger
 * /smartparking/vehicle/search:
 *   get:
 *     summary: "Search parking records"
 *     description: "Search parking records by plate number, driver name, or driver telephone."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: "Search keyword"
 *         example: "RAA 123B"
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
 *         description: Search results retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/vehicle/search', auditSuccess('READ', 'vehicles'), search_inparking_records)

/**
 * @swagger
 * /smartparking/vehicle/flagged:
 *   get:
 *     summary: "List flagged vehicles"
 *     description: "Retrieve a list of vehicles that have been flagged (e.g., overstayed, suspicious activity)."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: Flagged vehicles retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/vehicle/flagged', auditSuccess('READ', 'vehicles'), list_flagged_cars)

/**
 * @swagger
 * /smartparking/vehicle/{id}:
 *   get:
 *     summary: "Get parking record by ID"
 *     description: "Retrieve a single parking record by its MongoDB ObjectId."
 *     tags: [Smart Parking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Parking record MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Parking record retrieved successfully
 *       404:
 *         description: Parking record not found
 *       500:
 *         description: Internal server error
 */
Router.get('/vehicle/:id', auditSuccess('READ', 'vehicles'), get_parking_record_by_id)

/**
 * @swagger
 * /smartparking/vehicle/verify:
 *   post:
 *     summary: "Verify a vehicle"
 *     description: "Verify a vehicle by plate number before check-in. Checks if vehicle is registered, flagged, or has any restrictions."
 *     tags: [Smart Parking]
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
 *                 description: "Vehicle plate number to verify"
 *                 example: "RAA 123B"
 *     responses:
 *       200:
 *         description: Vehicle verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     is_registered:
 *                       type: boolean
 *                       example: true
 *                     is_flagged:
 *                       type: boolean
 *                       example: false
 *                     owner_name:
 *                       type: string
 *                       example: "Jean Baptiste Uwimana"
 *                     driver_type:
 *                       type: string
 *                       example: "staff"
 *       400:
 *         description: Plate number is required
 *       500:
 *         description: Internal server error
 */
Router.post('/vehicle/verify', auditSuccess('READ', 'vehicles'), verify_acar)

/**
 * @swagger
 * /smartparking/vehicle/checkin:
 *   post:
 *     summary: "Check in a vehicle"
 *     description: "Register a vehicle entering the parking lot. Creates a parking record and optionally links to a visitor record. Updates available slot counts."
 *     tags: [Smart Parking]
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
 *               driver_name:
 *                 type: string
 *                 description: "Driver's full name"
 *                 example: "Mukamana Alice"
 *               driver_telephone:
 *                 type: string
 *                 description: "Driver's phone number"
 *                 example: "+250788123456"
 *               driver_type:
 *                 type: string
 *                 description: "Type of driver"
 *                 enum: [staff, visitor, regular]
 *                 example: "visitor"
 *               driver_email:
 *                 type: string
 *                 example: "alice@example.com"
 *               driver_identification:
 *                 type: object
 *                 properties:
 *                   id_type:
 *                     type: string
 *                     example: "National ID"
 *                   number:
 *                     type: string
 *                     example: "1199880077881122"
 *     responses:
 *       201:
 *         description: Vehicle checked in successfully
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
 *                   example: "Vehicle checked in successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Plate number is required
 *       409:
 *         description: Vehicle already checked in
 *       500:
 *         description: Internal server error
 */
Router.post('/vehicle/checkin',
  auditSuccess('CREATE', 'vehicles', auditUserActions.checkIn),
  check_in
)

/**
 * @swagger
 * /smartparking/vehicle/checkout:
 *   post:
 *     summary: "Check out a vehicle"
 *     description: "Register a vehicle exiting the parking lot. Calculates parking duration and updates available slot counts. Auto-flags vehicles that overstay time limits."
 *     tags: [Smart Parking]
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
 *                 description: "Vehicle plate number to check out"
 *                 example: "RAA 123B"
 *     responses:
 *       200:
 *         description: Vehicle checked out successfully
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
 *                   example: "Vehicle checked out successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     duration:
 *                       type: string
 *                       example: "2h 30m"
 *                     is_flagged:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Plate number is required
 *       404:
 *         description: No active parking record found
 *       500:
 *         description: Internal server error
 */
Router.post('/vehicle/checkout',
  auditSuccess('UPDATE', 'vehicles', auditUserActions.checkOut),
  check_out
)

/**
 * @swagger
 * /smartparking/register-single:
 *   post:
 *     summary: "Register a single visitor reservation"
 *     description: "Register a single visitor parking reservation with their details."
 *     tags: [Smart Parking]
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
 *               - plate_number
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: "Habarurema Jean Pierre"
 *               plate_number:
 *                 type: string
 *                 example: "RAA 456C"
 *               telephone:
 *                 type: string
 *                 example: "+250788123456"
 *               email:
 *                 type: string
 *                 example: "jpierre@example.com"
 *     responses:
 *       201:
 *         description: Visitor reservation created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
Router.post('/register-single',
  auditSuccess('CREATE', 'reservations', (req, res, data) => `Created single visitor reservation`),
  registerSingleReservation
);

/**
 * @swagger
 * /smartparking/bulk-upload:
 *   post:
 *     summary: "Bulk upload visitor reservations"
 *     description: "Upload an Excel or CSV file to bulk create visitor parking reservations."
 *     tags: [Smart Parking]
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
 *                 description: "Excel (.xlsx, .xls) or CSV file with visitor reservation data"
 *     responses:
 *       200:
 *         description: Bulk upload processed successfully
 *       400:
 *         description: Invalid file format
 *       500:
 *         description: Internal server error
 */
Router.post('/bulk-upload',
  auditSuccess('CREATE', 'reservations', (req, res, data) => `Bulk uploaded visitor reservations`),
  upload.any(), bulkUploadReservations
);

// Add error logging middleware
Router.use(auditError('smart_parking'))

module.exports = Router