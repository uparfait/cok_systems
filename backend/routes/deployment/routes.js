const Router = require('express').Router();
const multer = require('multer');
const { get_deployment_targets, start_deployment, get_deployment_log } = require('../../controllers/deployment/deployment');
const { refuse_foreign_site, sign_certificate_upload, upload_certificate, get_certificate_history } = require('../../controllers/deployment/certificate');

/**
 * Deployment Management. Mounted in routes/routes.js behind authenticate
 * and authorize(GROUPS.ADMIN_DEPLOYMENT), so only a role whose sidebar
 * carries the Deployment Management link reaches any of it.
 */
Router.get('/targets', get_deployment_targets);
Router.post('/run', start_deployment);
Router.get('/log/:run_id', get_deployment_log);

/**
 * The certificate zip: one file of at most 5 MB, held in memory only long
 * enough to be checked and copied into deploy/runs. Multer's own errors
 * (too large, a second file) are answered as a plain 400 with a sentence.
 */
const MAX_ZIP_BYTES = 5 * 1024 * 1024;
const zip_upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ZIP_BYTES, files: 1, fields: 5 } }).single('file');

function accept_certificate_zip(req, res, next) {
    zip_upload(req, res, (error) => {
        if (!error) return next();
        const too_large = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
        return res.status(400).json({
            success: false,
            message: too_large ? 'The zip is larger than 5 MB. A certificate set is a few kilobytes; check that the right file was chosen.' : `The upload could not be read: ${error.message}.`,
        });
    });
}

Router.get('/certificate', get_certificate_history);
Router.post('/certificate/sign', sign_certificate_upload);
Router.post('/certificate', refuse_foreign_site, accept_certificate_zip, upload_certificate);

module.exports = Router;
