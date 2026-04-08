const Router = require('express').Router();
const changePasswordController = require('../../controllers/profile/change_password');
const authenticate = require('../../middlewares/authenticate');

Router.post('/change-password', authenticate, changePasswordController);

module.exports = Router;