const Router = require('express').Router();
const authenticate = require('../../middlewares/authenticate.js');

const createRequest = require('../../controllers/requests/create_request.js');
const updateRequest = require('../../controllers/requests/update_request.js');
const archiveRequest = require('../../controllers/requests/archive_request.js');
const getRequests = require('../../controllers/requests/get_requests.js');
const getStatistics = require('../../controllers/requests/get_statistics.js');
const exportExcel = require('../../controllers/requests/export_excel.js');

Router.post('/create', authenticate, createRequest);
Router.put('/:id', authenticate, updateRequest);
Router.post('/:id/archive', authenticate, archiveRequest);
Router.get('/', authenticate, getRequests);
Router.get('/statistics', authenticate, getStatistics);
Router.get('/export', authenticate, exportExcel);

module.exports = Router;
