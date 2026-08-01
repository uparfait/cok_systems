const Router = require('express').Router();
const authenticate = require('../../middlewares/authenticate.js');

const createRequest = require('../../controllers/requests/create_request.js');
const updateRequest = require('../../controllers/requests/update_request.js');
const archiveRequest = require('../../controllers/requests/archive_request.js');
const getRequests = require('../../controllers/requests/get_requests.js');
const getStatistics = require('../../controllers/requests/get_statistics.js');
const exportExcel = require('../../controllers/requests/export_excel.js');

const createOutgoing = require('../../controllers/outgoing/create_outgoing.js');
const updateOutgoing = require('../../controllers/outgoing/update_outgoing.js');
const getOutgoing = require('../../controllers/outgoing/get_outgoing.js');
const getOutgoingByRequest = require('../../controllers/outgoing/get_outgoing_by_request.js');
const getOutgoingTotal = require('../../controllers/outgoing/get_outgoing_total.js');
const exportOutgoing = require('../../controllers/outgoing/export_outgoing.js');

Router.post('/create', authenticate, createRequest);
Router.put('/:id', authenticate, updateRequest);
Router.post('/:id/archive', authenticate, archiveRequest);
Router.get('/', authenticate, getRequests);
Router.get('/statistics', authenticate, getStatistics);
Router.get('/export', authenticate, exportExcel);

Router.post('/outgoing/create', authenticate, createOutgoing);
Router.put('/outgoing/:id', authenticate, updateOutgoing);
Router.get('/outgoing', authenticate, getOutgoing);
Router.get('/outgoing/by-request/:requestId', authenticate, getOutgoingByRequest);
Router.get('/outgoing/total', authenticate, getOutgoingTotal);
Router.get('/outgoing/export', authenticate, exportOutgoing);

module.exports = Router;
