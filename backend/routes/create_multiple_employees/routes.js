const Router = require('express').Router();
const multer = require('multer');
const create_users_bulk = require('../../controllers/employee_crud/create_multiple_employees.js');

// Configure Multer for file upload
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    
    fileFilter: (req, file, cb) => {
        // Check file extension
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
            cb(null, true);
        } else {
            const error = new Error('Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file (.csv).');
            error.status = 400;
            cb(error);
        }
    }
});

// Global Multer error handler
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        console.warn('[UPLOAD WARNING]:', error.message);
        
        if (error.message.includes('Invalid file type')) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: error.message
            });
        }
        
        req.body = req.body || {};
        return next();
    }
    next();
});

Router.post('/employees', upload.any(), create_users_bulk);

module.exports = Router;