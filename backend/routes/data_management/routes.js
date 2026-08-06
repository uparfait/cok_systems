const Router = require('express').Router();
const storageController = require('../../controllers/data_management/storage_stats');
const authenticate = require('../../middlewares/authenticate');

Router.get('/storage-stats', authenticate, storageController.getStorageStats);
Router.post('/storage/request-delete', authenticate, storageController.requestDeleteToken);
Router.post('/storage/confirm-delete', authenticate, storageController.confirmDelete);

module.exports = Router;
