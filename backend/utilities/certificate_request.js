const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const runner = require('./deployment_runner');
const SslCertificate = require('../models/ssl_certificate');

/**
 * The SSL certificate side of Deployment Management.
 *
 * Nothing here installs anything. An upload is written into deploy/runs
 * exactly like a deployment (log, state, then the request LAST) and
 * deploy/certificate.sh on the host does the work; the page follows the
 * same log it follows for a deployment. The only thing the backend keeps
 * for itself is the record of which certificate is installed, in the
 * SslCertificate model, fed from the status file the agent maintains.
 */

const TARGET = 'certificate';
const LABEL = 'SSL certificate';
const STATUS_FILE = () => path.join(runner.LOG_DIR, 'certificate.json');
const CERTIFICATE_SCRIPT = path.join(runner.REPO_DIR, 'deploy', 'certificate.sh');

/**
 * A signature stands in for the password between the two pop-ups of the
 * upload: the password is checked once, a random token is handed back, and
 * the file is sent with that token - never with the password. Tokens live
 * in memory, belong to the user they were issued to, and are used once.
 */
const SIGNATURES = new Map();
const signature_ttl_ms = () => Number(process.env.DEPLOY_SIGNATURE_TTL_MS) || 15 * 60 * 1000;

function purge_signatures(now = Date.now()) {
    for (const [token, entry] of SIGNATURES) {
        if (entry.expires_at <= now) SIGNATURES.delete(token);
    }
}

function user_key(user) {
    return String((user && (user.user_id || user.id || user._id)) || (user && user.email) || '');
}

function issue_signature(user) {
    purge_signatures();
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = Date.now() + signature_ttl_ms();
    SIGNATURES.set(token, { user: user_key(user), expires_at });
    return { signature: token, expires_at: new Date(expires_at).toISOString() };
}

/** Why the signature is not accepted, or null; an accepted one is spent. */
function consume_signature(token, user) {
    purge_signatures();
    if (typeof token !== 'string' || token.length === 0) {
        return 'This upload carries no signature. Enter the deployment password first.';
    }
    const entry = SIGNATURES.get(token);
    if (!entry) return 'That upload signature is unknown or has expired. Enter the deployment password again.';
    if (entry.user !== user_key(user)) return 'That upload signature belongs to another session. Enter the deployment password again.';
    SIGNATURES.delete(token);
    return null;
}

/** The status file deploy/certificate.sh keeps about the installed certificate, or null. */
function read_certificate_status() {
    return runner.read_json(STATUS_FILE());
}

/** The host side that will carry the request is there. */
function upload_available() {
    return runner.agent_is_listening() || runner.execution_mode() === 'direct';
}

const DAY_MS = 24 * 60 * 60 * 1000;

function days_left_of(not_after) {
    const end = new Date(not_after).getTime();
    return Number.isFinite(end) ? Math.floor((end - Date.now()) / DAY_MS) : null;
}

/** A model document (or a status file) as the page shows it. */
function present(doc, source_note) {
    if (!doc) return null;
    return {
        subject: doc.subject || null,
        issuer: doc.issuer || null,
        hosts: Array.isArray(doc.hosts) ? doc.hosts : [],
        not_before: doc.not_before ? new Date(doc.not_before).toISOString() : null,
        not_after: doc.not_after ? new Date(doc.not_after).toISOString() : null,
        days_left: doc.not_after ? days_left_of(doc.not_after) : null,
        fingerprint: doc.fingerprint || null,
        installed_at: doc.installed_at ? new Date(doc.installed_at).toISOString() : null,
        installed_by: doc.installed_by || null,
        run_id: doc.run_id || null,
        file_name: doc.file_name || null,
        source: doc.source || source_note || null,
        checked_at: doc.checked_at ? new Date(doc.checked_at).toISOString() : null,
    };
}

/**
 * Brings the model up to date with the status file. The agent writes the
 * run_id of the run that installed the certificate into the status file,
 * so the installer is read from that run's state; a certificate first seen
 * on a heartbeat pass is recorded as "detected". Upserted by fingerprint,
 * so the same certificate is never recorded twice. Returns the document.
 */
async function reconcile_certificate() {
    const status = read_certificate_status();
    if (!status || status.installed === false || !status.fingerprint) return null;
    const existing = await SslCertificate.findOne({ fingerprint: status.fingerprint }).lean();
    const run = status.run_id ? runner.read_state(status.run_id) : null;
    if (existing && (existing.source === 'upload' || !run)) return existing;
    const fields = {
        fingerprint: status.fingerprint,
        subject: status.subject || null,
        issuer: status.issuer || null,
        hosts: Array.isArray(status.hosts) ? status.hosts : [],
        not_before: status.not_before ? new Date(status.not_before) : null,
        not_after: status.not_after ? new Date(status.not_after) : null,
        checked_at: status.checked_at ? new Date(status.checked_at) : new Date(),
        run_id: run ? run.run_id : null,
        file_name: run ? run.file_name || null : null,
        installed_by: run ? { user_id: run.started_by_id || null, email: run.started_by || null } : null,
        source: run ? 'upload' : 'detected',
    };
    const installed_at = run && run.finished_at ? new Date(run.finished_at) : new Date();
    return SslCertificate.findOneAndUpdate(
        { fingerprint: status.fingerprint },
        { $set: fields, $setOnInsert: { installed_at } },
        { upsert: true, new: true, lean: true },
    );
}

/** What the page shows at the top: the latest document, else the status file. */
async function installed_certificate() {
    try {
        await reconcile_certificate();
        const latest = await SslCertificate.findOne({}).sort({ installed_at: -1, _id: -1 }).lean();
        if (latest) return present(latest);
    } catch (error) {
        // Without the database the status file still says what is installed.
    }
    const status = read_certificate_status();
    return status && status.installed !== false && status.not_after ? present(status, 'detected') : null;
}

/** The latest document and every earlier one, newest first. */
async function certificate_history() {
    const docs = await SslCertificate.find({}).sort({ installed_at: -1, _id: -1 }).lean();
    return { current: docs.length ? present(docs[0]) : null, history: docs.slice(1).map((doc) => present(doc)) };
}

const zip_path = (run_id) => path.join(runner.LOG_DIR, `${run_id}.zip`);

/**
 * Queues the upload for the host. Returns { run_id } or { error, run_id? }.
 * The zip is written with the log and the state first and the request LAST,
 * so the agent can never see a request whose file is not there yet.
 */
function queue_certificate({ buffer, file_name, started_by, started_by_id, summary }) {
    const running = runner.current_run();
    if (running) {
        const label = running.target_label || (runner.TARGETS[running.target] ? runner.TARGETS[running.target].label : running.target);
        return { error: `A deployment is already running (${label}). Wait for it to finish.`, run_id: running.run_id };
    }
    const direct = runner.execution_mode() === 'direct';
    if (!direct && !runner.agent_is_listening()) {
        return { error: 'The deployment agent is not running on the server, so nothing can install the certificate. Start it on the host: sudo systemctl enable --now cok-deploy-agent (see deploy/cok-deploy-agent.service).' };
    }
    try {
        runner.ensure_log_dir();
        fs.accessSync(runner.LOG_DIR, fs.constants.W_OK);
    } catch (error) {
        return { error: `The deployment log folder ${runner.LOG_DIR} is not writable by this service (${error.message}).` };
    }

    const run_id = runner.new_run_id(TARGET);
    const now = new Date().toISOString();
    const state = {
        run_id,
        target: TARGET,
        target_label: LABEL,
        kind: TARGET,
        file_name: file_name || null,
        started_by: started_by || null,
        started_by_id: started_by_id || null,
        started_at: now,
        finished_at: null,
        status: runner.QUEUED,
        exit_code: null,
        error: null,
        pid: null,
        ran_by: direct ? 'backend' : 'host-agent',
    };
    const lines = [`=== ${LABEL} ===`, `requested by ${started_by || 'unknown'} at ${now}`, `file ${file_name || '(unnamed)'}`];
    if (summary) {
        lines.push(`certificate ${summary.subject}`, `valid until ${summary.not_after}`);
        if (summary.hosts.length) lines.push(`hosts ${summary.hosts.join(' ')}`);
    }
    if (!direct) lines.push('Waiting for the deployment agent on the server to pick this up...');
    const header = lines.concat(['', '']).join('\n');
    try {
        fs.writeFileSync(zip_path(run_id), buffer, { mode: 0o600 });
        fs.writeFileSync(runner.log_path(run_id), header);
        runner.write_json(runner.state_path(run_id), state);
        runner.write_json(runner.current_path(), { run_id });
        if (direct) return spawn_direct(run_id, state);
        fs.writeFileSync(runner.request_path(run_id), `${TARGET}\n`);
    } catch (error) {
        return { error: `Could not hand the certificate to the agent: ${error.message}` };
    }
    return { run_id };
}

/**
 * When this backend runs on the host itself there is no agent: the script
 * is run here, detached and writing straight into the log, the same way
 * update-deploy.sh is run for a deployment.
 */
function spawn_direct(run_id, state) {
    const file = runner.log_path(run_id);
    const posix = (value) => value.split('\\').join('/');
    const REDIRECT = 'exec bash "$1" --run "$2" >> "$3" 2>&1';
    const inner = ['-c', REDIRECT, 'cok-certificate', posix(CERTIFICATE_SCRIPT), run_id, posix(file)];
    const { use_sudo } = runner.resolve_privilege();
    const command = use_sudo ? 'sudo' : 'bash';
    const args = use_sudo ? ['-n', 'bash'].concat(inner) : inner;
    let child;
    try {
        child = spawn(command, args, { cwd: runner.REPO_DIR, detached: true, stdio: 'ignore', env: Object.assign({}, process.env, { TERM: 'dumb', NO_COLOR: '1' }) });
    } catch (error) {
        fs.appendFileSync(file, `\nCould not start the certificate install: ${error.message}\n`);
        runner.write_json(runner.state_path(run_id), Object.assign({}, state, { status: runner.FAILED, finished_at: new Date().toISOString(), error: error.message }));
        return { error: `Could not start the certificate install: ${error.message}`, run_id };
    }
    const running = Object.assign({}, state, { status: runner.RUNNING, pid: child.pid });
    runner.write_json(runner.state_path(run_id), running);
    const finish = (ok, note, exit_code) => {
        try {
            fs.appendFileSync(file, note);
            runner.write_json(runner.state_path(run_id), Object.assign({}, running, { status: ok ? runner.SUCCEEDED : runner.FAILED, finished_at: new Date().toISOString(), exit_code, error: ok ? null : note.trim() }));
        } catch (ignored) {
            // Nothing more can be reported.
        }
    };
    child.on('error', (error) => finish(false, `\nThe certificate install could not be run: ${error.message}\n`, null));
    child.on('exit', (code, signal) => finish(code === 0, code === 0 ? '\nCertificate installed.\n' : `\nCertificate install ${signal ? `was stopped (${signal})` : `failed with exit code ${code}`}.\n`, code));
    child.unref();
    return { run_id };
}

module.exports = {
    TARGET,
    LABEL,
    issue_signature,
    consume_signature,
    read_certificate_status,
    upload_available,
    reconcile_certificate,
    installed_certificate,
    certificate_history,
    queue_certificate,
    days_left_of,
};
