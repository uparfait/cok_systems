const Router = require('express').Router();
const storageController = require('../../controllers/data_management/storage_stats');
const authenticate = require('../../middlewares/authenticate');

Router.get('/storage-stats',storageController.getStorageStats);
Router.post('/storage/request-delete',storageController.requestDeleteToken);
Router.post('/storage/confirm-delete',storageController.confirmDelete);

module.exports = Router;
