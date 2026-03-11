/**
 * Statistics routes
 */

const Router = require('express').Router();


const multer = require('multer')
const upload = multer()
const statisticsController = require('../../controllers/statistics/statistics.js');


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


// Roles and Permissions
Router.get('/roles-permissions', statisticsController.getRolesWithPermissions);

// Departments with Leaders
Router.get('/departments-leaders', statisticsController.getDepartmentsWithLeaders);

// Employee Statistics
Router.get('/employees', statisticsController.getEmployeeStats);

// Emergency Cars Statistics
Router.get('/emergency-cars', statisticsController.getEmergencyCarsStats);

// Flagged Vehicles Statistics
Router.get('/flagged-vehicles', statisticsController.getFlaggedVehiclesStats);

// Currently Parked Statistics
Router.get('/currently-parked', statisticsController.getCurrentlyParkedStats);

// Service Delivery Statistics
Router.get('/service-delivery', statisticsController.getServiceDeliveryStats);

// Feedback Totals
Router.get('/feedback-totals', statisticsController.getFeedbackTotals);

// Feedback Average by Department
Router.get('/feedback-average', statisticsController.getFeedbackAverageByDepartment);

// Hourly Parking Statistics (for graphs)
Router.get('/hourly-parking', statisticsController.getHourlyParkingStats);

// Hourly Service Delivery Statistics (for graphs)
Router.get('/hourly-service-delivery', statisticsController.getHourlyServiceDeliveryStats);

module.exports = Router;
