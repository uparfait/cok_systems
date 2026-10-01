/**
 * /cok/api/legacy-data - System Admin review and removal of records stored
 * in the old structure. Mounted behind authenticate +
 * authorize(GROUPS.ADMIN_LEGACY_DATA) in routes/routes.js.
 */

const Router = require('express').Router();
const { auditSuccess, auditError } = require('../../middlewares/audit');
const { scan_legacy_data, delete_legacy_data } = require('../../controllers/legacy_data/legacy_data.js');

Router.get('/scan', scan_legacy_data);
Router.post('/delete', auditSuccess('DELETE', 'legacy_data', 'Old records deleted'), delete_legacy_data);

Router.use(auditError('legacy_data'));

module.exports = Router;
