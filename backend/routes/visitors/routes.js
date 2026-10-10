/**
 * /cok/api/visitors - the visitor registry and the global visitor panel.
 * Mounted in routes/routes.js behind authenticate + authorize(GROUPS.VISITORS);
 * per-action role rules live in controllers/visitors/permissions.js.
 */

const Router = require('express').Router();
const { auditSuccess, auditError } = require('../../middlewares/audit');
const { upload } = require('../../utilities/visitors/attachments.js');
const list_visitors = require('../../controllers/visitors/list_visitors.js');
const { get_visitor, lookup_visitor } = require('../../controllers/visitors/get_visitor.js');
const update_visitor = require('../../controllers/visitors/update_visitor.js');
const { send_to_department, serve_visitor, complete_service, transfer_visitor } = require('../../controllers/visitors/visitor_actions.js');
const { list_attachments, add_attachments, update_attachment, download_attachment } = require('../../controllers/visitors/visitor_attachments.js');
const export_visitors = require('../../controllers/serivice_delivery/export_visitors.js');

// Multipart parsing for the attachment routes only; failures become a 400.
const withFiles = (req, res, next) => upload.any()(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({ success: false, type: 'warning', message: 'The files could not be uploaded', error: error.message });
});

Router.get('/', list_visitors);
Router.get('/lookup', lookup_visitor);
Router.get('/export', export_visitors);
Router.get('/attachments/:attachmentId/file', download_attachment);

Router.get('/:id', get_visitor);
Router.put('/:id', auditSuccess('UPDATE', 'visitors', 'Visitor details updated'), update_visitor);

Router.post('/:id/send-to-department', auditSuccess('UPDATE', 'visitors', 'Visitor sent to a department'), send_to_department);
Router.post('/:id/serve', auditSuccess('UPDATE', 'visitors', 'Visitor service started'), serve_visitor);
Router.post('/:id/complete', auditSuccess('UPDATE', 'visitors', 'Visitor service completed'), complete_service);
Router.post('/:id/transfer', auditSuccess('UPDATE', 'visitors', 'Visitor transferred'), transfer_visitor);

Router.get('/:id/attachments', list_attachments);
Router.post('/:id/attachments', withFiles, auditSuccess('CREATE', 'visitor_attachments', 'Visitor attachments added'), add_attachments);
Router.put('/:id/attachments/:attachmentId', withFiles, auditSuccess('UPDATE', 'visitor_attachments', 'Visitor attachment updated'), update_attachment);

Router.use(auditError('visitors'));

module.exports = Router;
