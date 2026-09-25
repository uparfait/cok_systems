const runner = require('../../utilities/deployment_runner');
const { logAuditEvent } = require('../../middlewares/audit');

/**
 * The Deployment Management page: start one of the two deployments and read
 * its console output back as it is written.
 *
 * The output is read by BYTE OFFSET rather than held open on a stream, and
 * that is deliberate. update-deploy.sh rebuilds and restarts every
 * container, this backend among them, so any connection held open for the
 * length of a deploy is guaranteed to be cut by the deploy itself. The page
 * instead asks "what is there after byte N", which simply carries on across
 * the restart - and needs nothing special of nginx to do it.
 */

/** What the page offers as buttons, straight from the runner's own table. */
async function get_deployment_targets(req, res) {
    try {
        const targets = Object.keys(runner.TARGETS).map((key) => ({ key, label: runner.TARGETS[key].label }));
        const running = runner.current_run();
        const latest = running || runner.latest_run();
        // The address check is the server's answer, not the browser's: the
        // page is simply told the outcome so it can say why the buttons
        // will not work, and start_deployment checks it again anyway.
        const url_problem = runner.check_request_url(req.headers);
        return res.status(200).json({
            success: true,
            data: {
                targets,
                script_path: runner.SCRIPT_PATH,
                requires_password: true,
                // Shown on the page before anything is clicked, so a
                // misconfigured server or the wrong address says so
                // instead of failing on click.
                blocked_reason: url_problem || runner.blocking_reason(),
                current: running ? { run_id: running.run_id, target: running.target, started_at: running.started_at } : null,
                latest: latest
                    ? {
                          run_id: latest.run_id,
                          target: latest.target,
                          status: latest.status,
                          started_at: latest.started_at,
                          finished_at: latest.finished_at,
                          exit_code: latest.exit_code === undefined ? null : latest.exit_code,
                      }
                    : null,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Could not read the deployment state.', error: error.message });
    }
}

/** Starts a deployment. The target is a key, never a command. */
async function start_deployment(req, res) {
    try {
        const target = req.body && typeof req.body.target === 'string' ? req.body.target : '';
        if (!runner.TARGETS[target]) {
            return res.status(400).json({
                success: false,
                message: `Unknown deployment target. Choose one of: ${Object.keys(runner.TARGETS).join(', ')}.`,
            });
        }

        const who = (req.user && (req.user.email || req.user.full_name)) || 'unknown';

        // The address first: a request from anywhere but the real site is
        // refused before the password is even looked at, so this endpoint
        // cannot be used to guess the password from somewhere else.
        const url_problem = runner.check_request_url(req.headers);
        if (url_problem) {
            await logAuditEvent('DEPLOYMENT', `Refused ${target} from a disallowed address: ${url_problem}`, req);
            return res.status(403).json({ success: false, message: url_problem });
        }

        const password_problem = runner.check_password(req.body && req.body.password);
        if (password_problem) {
            await logAuditEvent('DEPLOYMENT', `Refused ${target}: ${password_problem} (by ${who})`, req);
            return res.status(401).json({ success: false, message: password_problem });
        }
        const result = runner.start_run(target, who);

        if (result.error) {
            await logAuditEvent('DEPLOYMENT', `Refused to start ${target}: ${result.error}`, req);
            // A deploy already running is a conflict, not a bad request.
            const already_running = Boolean(result.run_id) && /already running/i.test(result.error);
            return res.status(already_running ? 409 : 400).json({
                success: false,
                message: result.error,
                data: result.run_id ? { run_id: result.run_id } : null,
            });
        }

        return res.status(200).json({
            success: true,
            message: `Deployment of ${runner.TARGETS[target].label} started.`,
            data: { run_id: result.run_id, target, started_by: who },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Could not start the deployment.', error: error.message });
    }
}

/** Whatever the run has written after ?offset, plus where it now stands. */
async function get_deployment_log(req, res) {
    try {
        const run_id = req.params.run_id;
        // A run id names a file, so it may only ever be the shape this
        // service makes: timestamp, then the target key.
        if (typeof run_id !== 'string' || !/^[0-9TZ:.\-]+-[a-z-]+$/i.test(run_id) || run_id.includes('..') || run_id.includes('/') || run_id.includes('\\')) {
            return res.status(400).json({ success: false, message: 'That is not a deployment run id.' });
        }
        const offset = Number.parseInt(req.query.offset, 10);
        const result = runner.read_log(run_id, Number.isFinite(offset) ? offset : 0);
        if (result.error) {
            return res.status(404).json({ success: false, message: result.error });
        }
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Could not read the deployment log.', error: error.message });
    }
}

module.exports = { get_deployment_targets, start_deployment, get_deployment_log };
