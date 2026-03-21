/**
 * Below are routes for smartparking system
 */

const Router = require('express').Router()
const multer = require('multer');

const { bulkUploadReservations, registerSingleReservation } = require('../../controllers/reservationController');
const { getAllReservations, createStaffBooking, cancelReservation, reactivateReservation, bulkUploadStaff } = require('../../controllers/reservationsController');

// parfait's controllers
const check_in = require('../../controllers/smart_parking/check_in.js')
const check_out = require('../../controllers/smart_parking/check_out.js')
const get_parking_record_by_id = require('../../controllers/smart_parking/get_parking_record_by_id.js')
const list_flagged_cars = require('../../controllers/smart_parking/list_flagged_cars.js')
const list_parking = require('../../controllers/smart_parking/list_parking.js')
const search_inparking_records = require('../../controllers/smart_parking/search_inparking_records.js')
const verify_acar = require('../../controllers/smart_parking/verify_acar.js')

// 2. Configure Multer to store the uploaded Excel file in memory temporarily
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // Optional: limit file size to 5MB
    
    // FILTER EXCEL AND CSV FILES

    fileFilter: (req, file, cb) => {
        // Check by file extension as well since mimetype can be unreliable
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv',
            'application/octet-stream' // Some browsers send this for CSV
        ];
        
        if (allowedExtensions.includes(fileExtension) || allowedMimes.includes(file.mimetype)) {
            cb(null, true); // Accept the file
        } else {
            req.UploadError = {
                success: false,
                message: 'Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file (.csv).'
            }
            cb(null, true); // Reject the file
        }
    }
});

Router.get('/', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "GET smartparking"
    })
})

Router.post('/', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "POST smartparking"
    })
})


Router.put('/', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "PUT smartparking"
    })
})


Router.delete('/', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "DELETE smartparking"
    })
})



// parfaits routes


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

// Reservation endpoints - must be before /vehicle/:id to avoid conflicts
Router.get('/reservations', getAllReservations);
Router.post('/staff-booking', createStaffBooking);
Router.put('/reservations/:id/cancel', cancelReservation);
Router.put('/reservations/:id/reactivate', reactivateReservation);
Router.post('/bulk-staff-upload', upload.any(), bulkUploadStaff);

Router.get('/vehicle', list_parking)
Router.get('/vehicle/search', search_inparking_records)
Router.get('/vehicle/flagged', list_flagged_cars)
Router.get('/vehicle/:id', get_parking_record_by_id)
Router.post('/vehicle/verify', verify_acar)
Router.post('/vehicle/checkin', check_in)
Router.post('/vehicle/checkout', check_out)
// Option A: Single Visitor (Raw JSON)
Router.post('/register-single', registerSingleReservation);

// Option B: Bulk Excel Upload (Files)
Router.post('/bulk-upload', upload.any(), bulkUploadReservations);


module.exports = Router