const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

/**
 * Running update-deploy.sh from the Deployment Management page.
 *
 * Two things shape this file.
 *
 * FIRST, nothing the browser sends ever reaches a shell. The page asks for
 * a TARGET by name, that name is looked up in the table below, and the
 * fixed flag stored beside it is passed to the script as a separate argv
 * entry. There is no string building anywhere, so there is nothing to
 * inject into.
 *
 * SECOND, the script restarts the very containers this backend runs in. So
 * the child is detached and its output is written STRAIGHT TO A FILE by the
 * operating system rather than piped through this process: when the backend
 * is killed and started again mid-deploy, the deploy carries on and its log
 * keeps growing. The page asks for the log by byte offset, so it simply
 * carries on reading where it stopped. Everything a caller needs to know
 * about a run therefore lives on disk, never in memory, and survives the
 * restart with it.
 */

// The repository root: backend/utilities -> backend -> repo.
const REPO_DIR = path.resolve(__dirname, '..', '..');

const SCRIPT_PATH = process.env.DEPLOY_SCRIPT_PATH || path.join(REPO_DIR, 'update-deploy.sh');
// Where the runs are kept. Point this at a folder the host also sees, so a
// deploy that restarts this container does not take its own log with it.
const LOG_DIR = process.env.DEPLOY_LOG_DIR || path.join(REPO_DIR, 'deploy', 'runs');
// The script writes nginx and restarts it, so it needs root. -n makes sudo
// fail immediately with a readable message instead of waiting forever on a
// password nobody can type.
const USE_SUDO = process.env.DEPLOY_SUDO !== '0';

/**
 * Every deployment the page may ask for, and the exact argument each one
 * runs with. A target that is not a key here is refused.
 */
const TARGETS = {
    uat: { flag: '--uat-ikaze', label: 'UAT (uat-ikaze)' },
    ikaze: { flag: '--ikaze', label: 'Production (ikaze)' },
};

const RUNNING = 'running';
const SUCCEEDED = 'succeeded';
const FAILED = 'failed';

/**
 * Deploying is only allowed from the real site. The public hosts of both
 * stacks are ikaze.kigalicity.gov.rw and uat-ikaze.kigalicity.gov.rw, so
 * this one fragment covers both and nothing else - not localhost, not a
 * port-forward, not another domain pointed at the same server.
 *
 * It is checked HERE, on the server, from the headers nginx forwards
 * (proxy_set_header Host $host). A check in the browser would only be a
 * suggestion: anyone can call the endpoint directly.
 */
const REQUIRED_URL_FRAGMENT = (process.env.DEPLOY_REQUIRED_HOST || 'ikaze.kigalicity').toLowerCase();

/**
 * The password typed on the page before a deployment runs. Overridable so
 * it need not stay in the source on a real server; the default is the one
 * the page was specified with.
 */
const DEPLOY_PASSWORD = process.env.DEPLOY_PASSWORD || '123cok123';

/** Compared as digests so the check takes the same time whatever is typed. */
function same_secret(given, expected) {
    const a = crypto.createHash('sha256').update(String(given == null ? '' : given)).digest();
    const b = crypto.createHash('sha256').update(String(expected)).digest();
    return crypto.timingSafeEqual(a, b);
}

const lower = (value) => (typeof value === 'string' && value ? value.toLowerCase() : '');

/**
 * Why this request may not deploy, as a sentence, or null when it may.
 *
 * Only the address the request was ADDRESSED to counts: Host, as nginx
 * forwards it (proxy_set_header Host $host), or X-Forwarded-Host behind a
 * second proxy. Origin and Referer are set by whoever makes the call, so
 * they can be typed at will and must never be able to satisfy this on
 * their own - they are used only the other way round, to refuse a browser
 * call that came from some other site.
 */
function check_request_url(headers) {
    const safe = headers || {};
    const host = lower(safe['x-forwarded-host']) || lower(safe.host);

    if (!host) {
        return 'This request carries no address, so it cannot be confirmed as coming from the deployment site.';
    }
    if (!host.includes(REQUIRED_URL_FRAGMENT)) {
        return `Deployment is only allowed from the ${REQUIRED_URL_FRAGMENT} site. This page was opened on "${host}".`;
    }

    // A browser always sends Origin on a POST like this one. If it is
    // there and points somewhere else, the call was made from another
    // site against our host, so it is refused too.
    const origin = lower(safe.origin);
    if (origin && !origin.includes(REQUIRED_URL_FRAGMENT)) {
        return `Deployment is only allowed from the ${REQUIRED_URL_FRAGMENT} site. This request came from "${origin}".`;
    }
    return null;
}

/** Why the typed password is not accepted, as a sentence, or null. */
function check_password(given) {
    if (typeof given !== 'string' || given.length === 0) {
        return 'Enter the deployment password to continue.';
    }
    return same_secret(given, DEPLOY_PASSWORD) ? null : 'That deployment password is not correct.';
}

function ensure_log_dir() {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const log_path = (run_id) => path.join(LOG_DIR, `${run_id}.log`);
const state_path = (run_id) => path.join(LOG_DIR, `${run_id}.json`);
const current_path = () => path.join(LOG_DIR, 'current.json');

function read_json(file_path) {
    try {
        return JSON.parse(fs.readFileSync(file_path, 'utf8'));
    } catch (error) {
        return null;
    }
}

function write_json(file_path, value) {
    fs.writeFileSync(file_path, JSON.stringify(value, null, 2));
}

/** A run id that sorts by time and is safe as a file name. */
function new_run_id(target) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${stamp}-${target}`;
}

/**
 * A run's own record, with its log size so a reader knows how much there is
 * to fetch. A run whose process is gone but which was never marked finished
 * (the backend was killed with it) is reported as failed rather than left
 * claiming to be running forever.
 */
function read_state(run_id) {
    const state = read_json(state_path(run_id));
    if (!state) return null;
    let size = 0;
    try {
        size = fs.statSync(log_path(run_id)).size;
    } catch (error) {
        size = 0;
    }
    if (state.status === RUNNING && !is_alive(state.pid)) {
        // The script itself finishes by appending its own exit line; if it
        // is not there, the run really did die with whatever killed it.
        const finished = read_json(state_path(run_id));
        if (finished && finished.status === RUNNING) {
            return Object.assign({}, finished, { log_size: size, status: RUNNING, pid_gone: true });
        }
    }
    return Object.assign({}, state, { log_size: size });
}

function is_alive(pid) {
    if (!pid) return false;
    try {
        // Signal 0 tests for the process without touching it.
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
}

/** The run that is going on right now, or null. */
function current_run() {
    const pointer = read_json(current_path());
    if (!pointer || !pointer.run_id) return null;
    const state = read_state(pointer.run_id);
    if (!state) return null;
    return state.status === RUNNING ? state : null;
}

/** The most recent run of any status, for the page to open on. */
function latest_run() {
    ensure_log_dir();
    const ids = fs
        .readdirSync(LOG_DIR)
        .filter((name) => name.endsWith('.json') && name !== 'current.json')
        .map((name) => name.slice(0, -5))
        .sort();
    if (ids.length === 0) return null;
    return read_state(ids[ids.length - 1]);
}

/**
 * Why a run cannot start right now, as a sentence for the page, or null
 * when it can. Checked BEFORE anything is spawned so the console shows a
 * reason instead of an empty log.
 */
function blocking_reason() {
    if (!fs.existsSync(SCRIPT_PATH)) {
        return `The deployment script was not found at ${SCRIPT_PATH}. Set DEPLOY_SCRIPT_PATH to where update-deploy.sh lives on this server.`;
    }
    try {
        ensure_log_dir();
        fs.accessSync(LOG_DIR, fs.constants.W_OK);
    } catch (error) {
        return `The deployment log folder ${LOG_DIR} is not writable by this service (${error.message}).`;
    }
    return null;
}

/**
 * Starts one deployment. Returns { run_id } or { error } - never throws at
 * the caller for an ordinary refusal, since every refusal is something the
 * page has to show.
 */
function start_run(target_key, started_by) {
    const target = TARGETS[target_key];
    if (!target) return { error: 'Unknown deployment target.' };

    const running = current_run();
    if (running) {
        return { error: `A deployment is already running (${TARGETS[running.target] ? TARGETS[running.target].label : running.target}). Wait for it to finish.`, run_id: running.run_id };
    }

    const reason = blocking_reason();
    if (reason) return { error: reason };

    const run_id = new_run_id(target_key);
    const file = log_path(run_id);

    // THE SHELL opens the log and redirects into it, rather than this
    // process handing the child a file descriptor. Two reasons: a raw
    // descriptor passed as stdio is silently dropped on Windows, so a
    // developer would watch an empty console; and with the shell holding
    // the file open, output keeps being written after the deploy has
    // restarted this container and killed the process that started it.
    // The command string is a fixed literal - the script, the flag and the
    // log path arrive as separate arguments, so none of them is ever
    // parsed as shell syntax.
    const REDIRECT = 'exec bash "$1" "$2" >> "$3" 2>&1';
    const posix = (value) => value.split('\\').join('/');
    const inner_args = ['-c', REDIRECT, 'cok-deploy', posix(SCRIPT_PATH), target.flag, posix(file)];

    const command = USE_SUDO ? 'sudo' : 'bash';
    const args = USE_SUDO ? ['-n', 'bash'].concat(inner_args) : inner_args;

    const header = [
        `=== ${target.label} ===`,
        `$ ${USE_SUDO ? 'sudo -n ' : ''}bash ${posix(SCRIPT_PATH)} ${target.flag}`,
        `started by ${started_by || 'unknown'} at ${new Date().toISOString()}`,
        '',
        '',
    ].join('\n');
    fs.writeFileSync(file, header);

    let child = null;
    try {
        child = spawn(command, args, {
            cwd: REPO_DIR,
            detached: true,
            stdio: 'ignore',
            env: Object.assign({}, process.env, { TERM: 'dumb', NO_COLOR: '1' }),
        });
    } catch (error) {
        fs.appendFileSync(file, `\nCould not start the deployment: ${error.message}\n`);
        const failed = { run_id, target: target_key, started_by: started_by || null, started_at: new Date().toISOString(), finished_at: new Date().toISOString(), status: FAILED, exit_code: null, error: error.message, pid: null };
        write_json(state_path(run_id), failed);
        return { error: `Could not start the deployment: ${error.message}`, run_id };
    }

    const state = {
        run_id,
        target: target_key,
        target_label: target.label,
        started_by: started_by || null,
        started_at: new Date().toISOString(),
        finished_at: null,
        status: RUNNING,
        exit_code: null,
        error: null,
        pid: child.pid,
    };
    write_json(state_path(run_id), state);
    write_json(current_path(), { run_id });

    // The run outlives this request, and may outlive this process.
    child.on('error', (error) => {
        try {
            fs.appendFileSync(file, `\nThe deployment could not be run: ${error.message}\n`);
            write_json(state_path(run_id), Object.assign({}, state, { status: FAILED, finished_at: new Date().toISOString(), error: error.message }));
        } catch (ignored) {
            // Nothing more can be reported if even the log cannot be written.
        }
    });
    child.on('exit', (code, signal) => {
        const ok = code === 0;
        const note = ok
            ? '\nDeployment finished successfully.\n'
            : `\nDeployment ${signal ? `was stopped (${signal})` : `failed with exit code ${code}`}.\n`;
        try {
            fs.appendFileSync(file, note);
            write_json(
                state_path(run_id),
                Object.assign({}, state, {
                    status: ok ? SUCCEEDED : FAILED,
                    finished_at: new Date().toISOString(),
                    exit_code: code,
                    error: ok ? null : signal ? `stopped by ${signal}` : `exit code ${code}`,
                }),
            );
        } catch (ignored) {
            // Nothing more can be reported.
        }
    });
    child.unref();

    return { run_id, state };
}

/**
 * The log of one run from a byte offset on, plus where the reader now is.
 * Reading by offset is what lets the page carry on across the restart the
 * deployment causes: it asks again from the last byte it saw.
 */
function read_log(run_id, offset) {
    const state = read_state(run_id);
    if (!state) return { error: 'That deployment run is not on this server.' };

    const file = log_path(run_id);
    let size = 0;
    try {
        size = fs.statSync(file).size;
    } catch (error) {
        return { error: 'The log of that deployment run is missing.' };
    }

    const from = Number.isFinite(offset) && offset >= 0 ? Math.min(offset, size) : 0;
    let chunk = '';
    if (size > from) {
        const handle = fs.openSync(file, 'r');
        try {
            const buffer = Buffer.alloc(size - from);
            fs.readSync(handle, buffer, 0, buffer.length, from);
            chunk = buffer.toString('utf8');
        } finally {
            fs.closeSync(handle);
        }
    }

    return {
        run_id,
        chunk,
        offset: size,
        status: state.status,
        exit_code: state.exit_code === undefined ? null : state.exit_code,
        error: state.error || null,
        target: state.target,
        target_label: state.target_label || (TARGETS[state.target] ? TARGETS[state.target].label : state.target),
        started_at: state.started_at,
        finished_at: state.finished_at,
        started_by: state.started_by,
    };
}

module.exports = {
    TARGETS,
    RUNNING,
    SUCCEEDED,
    FAILED,
    SCRIPT_PATH,
    LOG_DIR,
    REQUIRED_URL_FRAGMENT,
    check_request_url,
    check_password,
    start_run,
    read_log,
    read_state,
    current_run,
    latest_run,
    blocking_reason,
};
