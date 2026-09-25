const Router = require('express').Router();
const { get_deployment_targets, start_deployment, get_deployment_log } = require('../../controllers/deployment/deployment');

/**
 * Deployment Management. Mounted in routes/routes.js behind authenticate
 * and authorize(GROUPS.ADMIN_DEPLOYMENT), so only a role whose sidebar
 * carries the Deployment Management link reaches any of it.
 */
Router.get('/targets', get_deployment_targets);
Router.post('/run', start_deployment);
Router.get('/log/:run_id', get_deployment_log);

module.exports = Router;
