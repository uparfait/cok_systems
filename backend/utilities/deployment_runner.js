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

/**
 * Where the checkout is, which is not the same place in both ways this
 * service runs:
 *
 *   in Docker    the image is built from ./backend alone, so /app has no
 *                repository above it. The checkout is bind-mounted at
 *                /repo instead (see the backend service in
 *                docker-compose.yml) - without that mount the script is
 *                simply not in the container.
 *   from source  the checkout really is two folders up, as the layout
 *                backend/utilities -> backend -> repo says.
 *
 * Whichever one actually holds update-deploy.sh wins, so this is worked
 * out rather than configured. The source layout is the fallback so the
 * "not found" message names a path a developer will recognise.
 */
const SOURCE_LAYOUT_REPO = path.resolve(__dirname, '..', '..');
const CANDIDATE_REPOS = ['/repo', SOURCE_LAYOUT_REPO];

/** The first candidate that actually holds the script; the source layout otherwise. */
function find_repo_dir(candidates = CANDIDATE_REPOS, fallback = SOURCE_LAYOUT_REPO) {
    const found = candidates.find((dir) => {
        try {
            return fs.existsSync(path.join(dir, 'update-deploy.sh'));
        } catch (error) {
            return false;
        }
    });
    return found || fallback;
}

const REPO_DIR = find_repo_dir();

// update-deploy.sh sits at the root of the checkout, beside
// docker-compose.yml, and reads that folder as its own REPO_DIR.
const SCRIPT_PATH = path.join(REPO_DIR, 'update-deploy.sh');
// Inside the container this resolves to /repo/deploy/runs, which IS the
// host's deploy/runs through the bind mount - so a deployment that
// restarts this container does not take its own console output with it.
const LOG_DIR = process.env.DEPLOY_LOG_DIR || path.join(REPO_DIR, 'deploy', 'runs');
/** Looks a command up on PATH, the way a shell would. */
function find_executable(name) {
    const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
    // On Windows a bare name is not enough; PATHEXT says what may be appended.
    const suffixes = process.platform === 'win32' ? String(process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
    return dirs.some((dir) =>
        suffixes.some((suffix) => {
            try {
                return fs.existsSync(path.join(dir, name + suffix.toLowerCase())) || fs.existsSync(path.join(dir, name + suffix));
            } catch (error) {
                return false;
            }
        }),
    );
}

/** True when this process is already root and has nothing to elevate. */
function is_root() {
    return typeof process.getuid === 'function' && process.getuid() === 0;
}

/**
 * Whether to put sudo in front of the script, worked out rather than
 * assumed - assuming it is what produced a bare "spawn sudo ENOENT".
 *
 * The script writes nginx and restarts containers, so it needs root. But
 * in a container this process ALREADY IS root, and images like
 * node:22-alpine ship no sudo at all - so reaching for sudo there fails
 * for a command that was never needed. On Windows there is no sudo and no
 * uid either.
 *
 * DEPLOY_SUDO=0 forces it off, which the tests use so they never ask for
 * root on the machine running them.
 */
function resolve_privilege() {
    if (process.env.DEPLOY_SUDO === '0') return { use_sudo: false, problem: null };
    // Windows 11 ships a sudo.exe, but it is not this sudo: it takes no -n
    // and there is no root to become. The deploy target is Linux anyway.
    if (process.platform === 'win32') return { use_sudo: false, problem: null };
    if (is_root()) return { use_sudo: false, problem: null };
    if (find_executable('sudo')) return { use_sudo: true, problem: null };
    return {
        use_sudo: false,
        problem:
            'This service is not running as root and sudo is not installed here, so the deployment script cannot write the nginx files or restart the containers. Run the backend as root (a container already is), or install sudo on this host.',
    };
}

/**
 * Every deployment the page may ask for, and the exact argument each one
 * runs with. A target that is not a key here is refused.
 */
const TARGETS = {
    uat: { flag: '--uat-ikaze', label: 'UAT (uat-ikaze)' },
    ikaze: { flag: '--ikaze', label: 'Production (ikaze)' },
};

const QUEUED = 'queued';
const RUNNING = 'running';
const SUCCEEDED = 'succeeded';
const FAILED = 'failed';

// How stale the agent's heartbeat may be before it counts as not running.
// It touches the file every few seconds (DEPLOY_AGENT_POLL_SECONDS).
const HEARTBEAT_STALE_MS = 30000;

/** What update-deploy.sh itself needs on the machine that runs it. */
const REQUIRED_TOOLS = ['bash', 'docker', 'git', 'curl', 'nginx'];

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
const request_path = (run_id) => path.join(LOG_DIR, `${run_id}.request`);
const current_path = () => path.join(LOG_DIR, 'current.json');
const heartbeat_path = () => path.join(LOG_DIR, 'agent.heartbeat');

/**
 * How a deployment actually gets run here.
 *
 *   'direct'  everything update-deploy.sh needs is on this machine and this
 *             process may use it, so it is spawned straight away. That is
 *             the case when the backend runs on the host itself.
 *   'agent'   something is missing - almost always because this is the
 *             alpine container, which has no bash, docker, git or nginx,
 *             and which the deployment would restart out from under
 *             itself. The request is written into deploy/runs instead and
 *             deploy/deploy-agent.sh, running on the host, does the work.
 *
 * Worked out rather than configured, so the same image behaves correctly
 * whether it is started in Docker or run from the checkout.
 */
function execution_mode() {
    const { problem } = resolve_privilege();
    if (problem) return 'agent';
    return REQUIRED_TOOLS.every((name) => find_executable(name)) ? 'direct' : 'agent';
}

/** Whether the host agent has checked in recently enough to be trusted. */
function agent_is_listening() {
    try {
        return Date.now() - fs.statSync(heartbeat_path()).mtimeMs < HEARTBEAT_STALE_MS;
    } catch (error) {
        return false;
    }
}

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
    // A run the host agent owns has no pid this process could ever ask
    // about - and must not be judged dead for it. The agent writes the
    // finished state itself.
    if (state.ran_by !== 'host-agent' && state.status === RUNNING && !is_alive(state.pid)) {
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
    // Queued counts: the agent has not started it yet, but it is going to,
    // so a second deployment must still be refused.
    return state.status === RUNNING || state.status === QUEUED ? state : null;
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
 *
 * script_path is the real script everywhere but the tests, which hand in a
 * stand-in - update-deploy.sh rebuilds the servers and cannot be run from
 * a test. It is a parameter rather than a setting because on a real server
 * there is only ever one answer.
 */
function blocking_reason(script_path = SCRIPT_PATH) {
    if (!fs.existsSync(script_path)) {
        return `The deployment script was not found at ${script_path}. Mount the checkout into this container (docker-compose.yml mounts ./ at /repo), or run this service from the checkout itself.`;
    }
    try {
        ensure_log_dir();
        fs.accessSync(LOG_DIR, fs.constants.W_OK);
    } catch (error) {
        return `The deployment log folder ${LOG_DIR} is not writable by this service (${error.message}).`;
    }

    // A stand-in script (the tests) is run here and needs only bash; the
    // real one is handed to whichever side can actually carry it.
    const is_real_script = path.resolve(script_path) === path.resolve(SCRIPT_PATH);
    if (!is_real_script) {
        return find_executable('bash') ? null : 'Deployment needs bash, which is not installed where this service runs.';
    }

    // Handing the work to the host agent: the only thing that can stop us
    // is the agent not being there to pick it up.
    if (execution_mode() === 'agent') {
        if (agent_is_listening()) return null;
        return 'The deployment agent is not running on the server. This backend cannot deploy by itself - update-deploy.sh needs the host\'s nginx, docker and git, and it restarts this very container. Start the agent on the host: sudo systemctl enable --now cok-deploy-agent (see deploy/cok-deploy-agent.service).';
    }

    // Running it here, so everything it needs must be here.
    const { problem } = resolve_privilege();
    if (problem) return problem;
    const missing = REQUIRED_TOOLS.filter((name) => !find_executable(name));
    if (missing.length > 0) {
        return `Deployment needs ${missing.join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} not installed where this service runs.`;
    }
    return null;
}

/**
 * Starts one deployment. Returns { run_id } or { error } - never throws at
 * the caller for an ordinary refusal, since every refusal is something the
 * page has to show.
 */
/**
 * Writes the run down for deploy/deploy-agent.sh to pick up, and leaves it
 * queued. The request file is written LAST, so the agent can never find a
 * request whose log and state are not there yet.
 */
function queue_for_agent(target_key, target, started_by) {
    const run_id = new_run_id(target_key);
    const state = {
        run_id,
        target: target_key,
        target_label: target.label,
        started_by: started_by || null,
        started_at: new Date().toISOString(),
        finished_at: null,
        status: QUEUED,
        exit_code: null,
        error: null,
        pid: null,
        ran_by: 'host-agent',
    };
    try {
        fs.writeFileSync(
            log_path(run_id),
            [
                `=== ${target.label} ===`,
                `requested by ${started_by || 'unknown'} at ${new Date().toISOString()}`,
                'Waiting for the deployment agent on the server to pick this up...',
                '',
                '',
            ].join('\n'),
        );
        write_json(state_path(run_id), state);
        write_json(current_path(), { run_id });
        fs.writeFileSync(request_path(run_id), `${target_key}\n`);
    } catch (error) {
        return { error: `Could not hand the deployment to the agent: ${error.message}` };
    }
    return { run_id, state };
}

function start_run(target_key, started_by, script_path = SCRIPT_PATH) {
    const target = TARGETS[target_key];
    if (!target) return { error: 'Unknown deployment target.' };

    const running = current_run();
    if (running) {
        return { error: `A deployment is already running (${TARGETS[running.target] ? TARGETS[running.target].label : running.target}). Wait for it to finish.`, run_id: running.run_id };
    }

    const reason = blocking_reason(script_path);
    if (reason) return { error: reason };

    // Nothing to spawn here: the host agent does the work. The page reads
    // the same log either way, so it cannot tell the difference beyond the
    // brief "queued" it shows first.
    const is_real_script = path.resolve(script_path) === path.resolve(SCRIPT_PATH);
    if (is_real_script && execution_mode() === 'agent') {
        return queue_for_agent(target_key, target, started_by);
    }

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
    const inner_args = ['-c', REDIRECT, 'cok-deploy', posix(script_path), target.flag, posix(file)];

    // -n so sudo fails at once with a readable message rather than waiting
    // forever on a password nobody is there to type.
    const { use_sudo } = resolve_privilege();
    const command = use_sudo ? 'sudo' : 'bash';
    const args = use_sudo ? ['-n', 'bash'].concat(inner_args) : inner_args;

    const header = [
        `=== ${target.label} ===`,
        `$ ${use_sudo ? 'sudo -n ' : ''}bash ${posix(script_path)} ${target.flag}`,
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
    const file = log_path(run_id);
    let size = 0;
    let log_exists = true;
    try {
        size = fs.statSync(file).size;
    } catch (error) {
        log_exists = false;
    }

    // The state file can be gone while the log is still there - a run
    // started before deploy/runs was a bind mount left its state inside a
    // container that has since been replaced. The output is still worth
    // showing, so this reports what it has instead of answering 404 and
    // leaving the page with a blank console and nothing to read.
    const state = read_state(run_id) || {
        run_id,
        target: run_id.replace(/^.*-/, ''),
        status: FAILED,
        exit_code: null,
        error: 'The record of this run is gone from the server, so how it ended is not known. Its output is shown below if any was kept.',
        started_at: null,
        finished_at: null,
        started_by: null,
    };

    if (!log_exists) {
        return {
            error: `That deployment run is not on this server. Its log would be ${file}; nothing is there. A run from before deploy/runs was shared with the host does not survive the container being replaced.`,
        };
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
    QUEUED,
    RUNNING,
    SUCCEEDED,
    FAILED,
    execution_mode,
    agent_is_listening,
    SCRIPT_PATH,
    LOG_DIR,
    CANDIDATE_REPOS,
    find_repo_dir,
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
