/**
 * Below are routes for smartparking system
 */

const Router = require('express').Router()
const multer = require('multer');

const { bulkUploadReservations } = require('../../controllers/reservationController');

// 2. Configure Multer to store the uploaded Excel file in memory temporarily
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // Optional: limit file size to 5MB
    
    // FILTER EXCEL FILES ONLY

    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true); // Accept the file
        } else {
            req.UploadError = {
                success: false,
                message: 'Invalid file type. Please upload an Excel file (.xlsx or .xls).'
            }
            cb(null, true); // Reject the file
        }
    }
});

/**
 * Initial testing routes
 */

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

// POST: Bulk upload visitors via Excel sheet
Router.post('/bulk-upload', upload.any(), bulkUploadReservations);


module.exports = Router