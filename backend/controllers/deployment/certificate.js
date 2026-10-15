const runner = require('../../utilities/deployment_runner');
const certificates = require('../../utilities/certificate_request');
const { inspect_certificate_zip } = require('../../utilities/certificate_zip');
const { logAuditEvent } = require('../../middlewares/audit');

/**
 * Uploading an SSL certificate from the Deployment Management page, in two
 * steps so the password never travels with the file:
 *
 *   POST /certificate/sign  { password }        -> { signature, expires_at }
 *   POST /certificate       multipart "file" + header X-Deploy-Signature
 *                                               -> { run_id }
 *
 * Both are refused unless the request was addressed to the deployment
 * site, exactly as a code deployment is. The run the second one queues is
 * followed through the same log endpoint as a deployment.
 */

const who_is = (req) => (req.user && (req.user.email || req.user.full_name)) || 'unknown';
const user_id_of = (req) => (req.user && String(req.user.user_id || req.user.id || req.user._id || '')) || null;

/** The site check alone, run before the upload is even read. */
async function refuse_foreign_site(req, res, next) {
    const url_problem = runner.check_request_url(req.headers);
    if (!url_problem) return next();
    await logAuditEvent('DEPLOYMENT', `Refused a certificate request from a disallowed address: ${url_problem}`, req);
    return res.status(403).json({ success: false, message: url_problem });
}

/** Step one: the password, answered with a short-lived single-use signature. */
async function sign_certificate_upload(req, res) {
    try {
        const url_problem = runner.check_request_url(req.headers);
        if (url_problem) {
            await logAuditEvent('DEPLOYMENT', `Refused a certificate signature from a disallowed address: ${url_problem}`, req);
            return res.status(403).json({ success: false, message: url_problem });
        }
        const password_problem = runner.check_password(req.body && req.body.password);
        if (password_problem) {
            await logAuditEvent('DEPLOYMENT', `Refused a certificate signature: ${password_problem} (by ${who_is(req)})`, req);
            return res.status(403).json({ success: false, message: password_problem });
        }
        if (!certificates.upload_available()) {
            return res.status(400).json({ success: false, message: 'The deployment agent is not running on the server, so a certificate cannot be installed right now. Start it on the host: sudo systemctl enable --now cok-deploy-agent.' });
        }
        const signed = certificates.issue_signature(req.user);
        return res.status(200).json({ success: true, data: signed });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Could not sign the certificate upload.', error: error.message });
    }
}

/** Step two: the zip, accepted only with a signature from step one. */
async function upload_certificate(req, res) {
    try {
        const who = who_is(req);
        const signature = req.get('x-deploy-signature');
        const signature_problem = certificates.check_signature(signature, req.user);
        if (signature_problem) {
            await logAuditEvent('DEPLOYMENT', `Refused a certificate upload: ${signature_problem} (by ${who})`, req);
            return res.status(401).json({ success: false, message: signature_problem });
        }
        if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
            return res.status(400).json({ success: false, message: 'Choose the zip file that holds the private key, the certificate and the chain.' });
        }
        const file_name = String(req.file.originalname || 'certificate.zip').split(/[\\/]/).pop().slice(0, 200);
        const inspected = await inspect_certificate_zip(req.file.buffer);
        if (inspected.error) {
            await logAuditEvent('DEPLOYMENT', `Refused certificate zip ${file_name}: ${inspected.error} (by ${who})`, req);
            return res.status(400).json({ success: false, message: inspected.error });
        }
        certificates.spend_signature(signature);
        const result = certificates.queue_certificate({
            buffer: req.file.buffer,
            file_name,
            started_by: who,
            started_by_id: user_id_of(req),
            summary: inspected.summary,
        });
        if (result.error) {
            await logAuditEvent('DEPLOYMENT', `Refused to queue certificate ${file_name}: ${result.error}`, req);
            const already_running = Boolean(result.run_id) && /already running/i.test(result.error);
            return res.status(already_running ? 409 : 400).json({ success: false, message: result.error, data: result.run_id ? { run_id: result.run_id } : null });
        }
        return res.status(200).json({
            success: true,
            message: 'The certificate was handed to the server for installation.',
            data: { run_id: result.run_id, target: certificates.TARGET, started_by: who, certificate: inspected.summary },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Could not accept the certificate.', error: error.message });
    }
}

/** The installed certificate and every earlier one, newest first. */
async function get_certificate_history(req, res) {
    try {
        await certificates.reconcile_certificate();
        const data = await certificates.certificate_history();
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Could not read the certificate history.', error: error.message });
    }
}

module.exports = { refuse_foreign_site, sign_certificate_upload, upload_certificate, get_certificate_history };
