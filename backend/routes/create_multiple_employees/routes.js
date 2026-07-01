const Router = require('express').Router();
const multer = require('multer');
const create_users_bulk = require('../../controllers/employee_crud/create_multiple_employees.js');
const download_employee_template = require('../../controllers/employee_crud/download_employee_template.js');

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

/**
 * @swagger
 * /multiple/employees:
 *   post:
 *     summary: "Bulk create employees from Excel/CSV file"
 *     description: "Upload an Excel (.xlsx, .xls) or CSV file to bulk create multiple employee accounts at once. The file should follow the required template format."
 *     tags: [Bulk Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file (.xlsx, .xls) or CSV file containing employee data
 *     responses:
 *       200:
 *         description: Employees created successfully (or partial success with error details)
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
 *                   example: "Successfully created 50 employees"
 *                 data:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: integer
 *                       example: 50
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           row:
 *                             type: integer
 *                             example: 5
 *                           error:
 *                             type: string
 *                             example: "Email already exists"
 *       400:
 *         description: Invalid file type or format
 *       500:
 *         description: Internal server error
 */
Router.post('/employees', upload.any(), create_users_bulk);

/**
 * @swagger
 * /multiple/employees/template:
 *   get:
 *     summary: "Download employee bulk upload template"
 *     description: "Download an Excel template file with the correct format for bulk employee upload. The template includes example data and required columns."
 *     tags: [Bulk Operations]
 *     responses:
 *       200:
 *         description: Excel template file downloaded
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Internal server error
 */
Router.get('/employees/template', download_employee_template);

module.exports = Router;