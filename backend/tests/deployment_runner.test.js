const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * The deployment runner, against stand-in scripts rather than the real
 * update-deploy.sh - which rebuilds the servers and cannot be run from a
 * test.
 *
 * Two things are worth a test here, both of them the reason this code is
 * shaped the way it is. The output has to arrive IN PIECES while the script
 * is still running, since that is what the page's console reads; and a
 * refusal - an unknown target, a missing script, a second run, a run id
 * that tries to leave the log folder - has to come back as a sentence
 * rather than as a thrown error or an empty console.
 */

const RUNNER = path.join(__dirname, '..', 'utilities', 'deployment_runner.js');

const HAPPY = ['#!/usr/bin/env bash', 'echo "flag=$1"', 'for i in 1 2 3; do echo "step $i"; sleep 0.3; done', 'echo "Done"', 'exit 0'].join('\n');
const FAILING = ['#!/usr/bin/env bash', 'echo "starting"', 'echo "something broke" >&2', 'exit 3'].join('\n');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let work = '';

/**
 * A runner with its own log folder. The stand-in script is handed to each
 * start_run call instead of being configured: update-deploy.sh always sits
 * at the root of the checkout, beside docker-compose.yml, so its location
 * is not something a server gets to set.
 */
function load_runner(log_dir) {
    delete require.cache[require.resolve(RUNNER)];
    process.env.DEPLOY_LOG_DIR = log_dir;
    // The stand-in scripts need no root, and a test must never ask for it.
    process.env.DEPLOY_SUDO = '0';
    return require(RUNNER);
}

function write_script(name, body) {
    const file = path.join(work, name);
    fs.writeFileSync(file, body);
    return file;
}

/** Reads a run to completion the way the page does: by byte offset. */
async function read_to_end(runner, run_id) {
    let offset = 0;
    let text = '';
    let reads = 0;
    let status = 'running';
    while (status === 'running' && reads < 80) {
        const page = runner.read_log(run_id, offset);
        // A refused read carries only an error; a successful one always
        // names its run (and may carry the script's own error text).
        assert.ok(page.run_id, `read_log refused: ${page.error}`);
        text += page.chunk;
        offset = page.offset;
        status = page.status;
        reads += 1;
        await sleep(120);
    }
    // One more read: the closing lines are appended after the status flips.
    const tail = runner.read_log(run_id, offset);
    return { text: text + tail.chunk, reads, page: tail };
}

async function run_all_tests() {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-runner-test-'));
    try {
        await test_a_run_streams_its_output_in_pieces();
        await test_only_one_run_at_a_time();
        await test_a_failing_script_is_reported();
        await test_a_missing_script_is_refused_before_running();
        await test_an_unknown_target_is_refused();
        await test_a_run_id_cannot_leave_the_log_folder();
        await test_only_the_deployment_site_may_deploy();
        await test_the_password_is_checked_here();
        await test_the_checkout_is_found_in_both_layouts();
        await test_the_real_script_needs_its_tools();
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
}

/**
 * The console's whole premise: output is readable while the script is still
 * going, and re-reading from the last byte adds nothing twice.
 */
async function test_a_run_streams_its_output_in_pieces() {
    const script = write_script('happy.sh', HAPPY);
    const runner = load_runner(path.join(work, 'happy-runs'));
    const started = runner.start_run('uat', 'tester@kigalicity.gov.rw', script);
    assert.ok(started.run_id, `the run did not start: ${started.error}`);

    const { text, reads, page } = await read_to_end(runner, started.run_id);

    assert.strictEqual(page.status, 'succeeded', 'a script exiting 0 succeeded');
    assert.strictEqual(page.exit_code, 0, 'its exit code is kept');
    assert.ok(reads > 1, `output must arrive over several reads, not all at the end (reads: ${reads})`);
    assert.ok(text.includes('flag=--uat-ikaze'), 'the UAT target runs the script with --uat-ikaze');
    ['step 1', 'step 2', 'step 3'].forEach((step) => {
        assert.ok(text.includes(step), `${step} reached the log`);
    });
    assert.ok(text.includes('tester@kigalicity.gov.rw'), 'the header records who started it');
    assert.ok(text.includes('Deployment finished successfully.'), 'the run says how it ended');

    const again = runner.read_log(started.run_id, page.offset);
    assert.strictEqual(again.chunk, '', 'reading from the end again returns nothing, so nothing is shown twice');
    assert.strictEqual(runner.current_run(), null, 'a finished run is not left claiming to be running');
}

/** Production runs the other flag, and two deploys must never overlap. */
async function test_only_one_run_at_a_time() {
    const script = write_script('happy2.sh', HAPPY);
    const runner = load_runner(path.join(work, 'single-runs'));
    const first = runner.start_run('ikaze', 'tester@x', script);
    assert.ok(first.run_id, 'the first run starts');

    const second = runner.start_run('uat', 'tester@x', script);
    assert.ok(/already running/i.test(second.error || ''), `a second run must be refused, got: ${second.error}`);
    assert.strictEqual(second.run_id, first.run_id, 'the refusal hands back the run that IS going, so the page can follow it');

    const { text } = await read_to_end(runner, first.run_id);
    assert.ok(text.includes('flag=--ikaze'), 'the production target runs the script with --ikaze');
}

/** A failure has to be visible, with its reason and its output. */
async function test_a_failing_script_is_reported() {
    const script = write_script('failing.sh', FAILING);
    const runner = load_runner(path.join(work, 'fail-runs'));
    const started = runner.start_run('ikaze', 'tester@x', script);
    assert.ok(started.run_id, 'the failing run still starts');

    const { text, page } = await read_to_end(runner, started.run_id);
    assert.strictEqual(page.status, 'failed', 'a non-zero exit is a failure');
    assert.strictEqual(page.exit_code, 3, 'the real exit code is reported');
    assert.ok(/exit code 3/.test(page.error || ''), `the page is given a reason, got: ${page.error}`);
    assert.ok(text.includes('starting'), 'its stdout is in the log');
    assert.ok(text.includes('something broke'), 'and so is its stderr - a script fails on stderr, so losing it would hide why');
}

/** A misconfigured server says so instead of opening an empty console. */
async function test_a_missing_script_is_refused_before_running() {
    const missing = path.join(work, 'not-here.sh');
    const runner = load_runner(path.join(work, 'missing-runs'));
    assert.ok(/was not found/.test(runner.blocking_reason(missing) || ''), 'the page is told before anything is clicked');
    const started = runner.start_run('uat', 'tester@x', missing);
    assert.ok(/was not found/.test(started.error || ''), 'and starting is refused with the same sentence');
    assert.strictEqual(started.run_id, undefined, 'no run is recorded for something that never ran');
}

/** Nothing the browser sends may become a command. */
async function test_an_unknown_target_is_refused() {
    const script = write_script('happy3.sh', HAPPY);
    const runner = load_runner(path.join(work, 'unknown-runs'));
    ['', 'nope', '--ikaze', 'uat; rm -rf /', '../../etc/passwd'].forEach((target) => {
        const result = runner.start_run(target, 'tester@x', script);
        assert.ok(result.error, `target ${JSON.stringify(target)} must be refused`);
        assert.strictEqual(result.run_id, undefined, `target ${JSON.stringify(target)} must not start anything`);
    });
    assert.deepStrictEqual(Object.keys(runner.TARGETS).sort(), ['ikaze', 'uat'], 'exactly two deployments are on offer');
}

/** A run id names a file, so it must not be able to name another one. */
async function test_a_run_id_cannot_leave_the_log_folder() {
    const runner = load_runner(path.join(work, 'traverse-runs'));
    ['../../../etc/passwd', '..\\..\\secret', 'current'].forEach((run_id) => {
        const result = runner.read_log(run_id, 0);
        assert.ok(result.error, `run id ${JSON.stringify(run_id)} must find nothing`);
    });
}

/**
 * Only the real site may deploy, and that is decided from the address the
 * request was ADDRESSED to. Origin and Referer are typed by the caller, so
 * a forged one must never be enough on its own - which is the whole reason
 * this check lives on the server rather than in the page.
 */
async function test_only_the_deployment_site_may_deploy() {
    const runner = load_runner(path.join(work, 'url-runs'));

    const allowed = [
        ['production host', { host: 'ikaze.kigalicity.gov.rw' }],
        ['UAT host', { host: 'uat-ikaze.kigalicity.gov.rw' }],
        ['host plus its own origin', { host: 'ikaze.kigalicity.gov.rw', origin: 'https://ikaze.kigalicity.gov.rw' }],
        ['forwarded by a second proxy', { host: 'backend:2026', 'x-forwarded-host': 'ikaze.kigalicity.gov.rw' }],
    ];
    allowed.forEach(([label, headers]) => {
        assert.strictEqual(runner.check_request_url(headers), null, `${label} must be allowed`);
    });

    const refused = [
        ['localhost', { host: 'localhost:5173' }],
        ['another domain', { host: 'evil.example' }],
        ['a forged Referer', { host: 'evil.example', referer: 'https://ikaze.kigalicity.gov.rw/x' }],
        ['a forged Origin', { host: 'evil.example', origin: 'https://ikaze.kigalicity.gov.rw' }],
        ['our host called from another site', { host: 'ikaze.kigalicity.gov.rw', origin: 'https://evil.example' }],
        ['no address at all', {}],
    ];
    refused.forEach(([label, headers]) => {
        assert.ok(runner.check_request_url(headers), `${label} must be refused`);
    });
}

/** The password is the server's to judge, and a wrong one starts nothing. */
async function test_the_password_is_checked_here() {
    const runner = load_runner(path.join(work, 'password-runs'));
    assert.strictEqual(runner.check_password('123cok123'), null, 'the deployment password is accepted');
    ['', '  ', 'wrong', '123cok124', '123COK123', null, undefined, 12345].forEach((given) => {
        assert.ok(runner.check_password(given), `${JSON.stringify(given)} must be refused`);
    });
}

/**
 * The checkout is in a different place depending on how this service runs.
 * In Docker the image is built from ./backend alone, so /app has nothing
 * above it and the checkout is bind-mounted at /repo; from source it really
 * is two folders up. Picking the wrong one is what made the page find no
 * script at all inside a container.
 */
async function test_the_checkout_is_found_in_both_layouts() {
    const runner = load_runner(path.join(work, 'repo-runs'));

    // A stand-in for each layout: only one of them holds the script.
    const mounted = path.join(work, 'as-container');
    const from_source = path.join(work, 'as-source');
    const empty = path.join(work, 'nothing-here');
    [mounted, from_source, empty].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
    fs.writeFileSync(path.join(mounted, 'update-deploy.sh'), '#!/usr/bin/env bash\n');
    fs.writeFileSync(path.join(from_source, 'update-deploy.sh'), '#!/usr/bin/env bash\n');

    assert.strictEqual(
        runner.find_repo_dir([mounted, from_source], from_source),
        mounted,
        'the bind mount wins when it holds the script - that is the container',
    );
    assert.strictEqual(
        runner.find_repo_dir([empty, from_source], from_source),
        from_source,
        'with no mount, the checkout two folders up is used - that is running from source',
    );
    assert.strictEqual(
        runner.find_repo_dir([empty, path.join(work, 'also-nothing')], from_source),
        from_source,
        'finding it nowhere falls back to the source layout, so the error names a familiar path',
    );

    // And the real constant must still name the mount the compose file makes.
    assert.ok(
        runner.CANDIDATE_REPOS.includes('/repo'),
        'the bind mount path must match docker-compose.yml, which mounts ./ at /repo',
    );
}

/**
 * update-deploy.sh needs docker, git, curl and nginx, and root to use them.
 * Missing any of those has to be SAID - the first version of this reached
 * for sudo unconditionally and the page got a bare "spawn sudo ENOENT",
 * which explains nothing to whoever clicked the button.
 *
 * A stand-in script needs none of that, so the tool check applies only
 * when the real script is what is about to run.
 */
async function test_the_real_script_needs_its_tools() {
    const runner = load_runner(path.join(work, 'tools-runs'));

    // A stand-in is never held to update-deploy.sh's own requirements.
    const stand_in = write_script('tools-happy.sh', HAPPY);
    assert.strictEqual(
        runner.blocking_reason(stand_in),
        null,
        'a stand-in script must not be blocked for lacking docker or nginx',
    );

    // The real one is, and the reason has to name what is missing rather
    // than failing later with a spawn error.
    const real = runner.blocking_reason();
    if (real !== null) {
        assert.ok(
            /not installed|not running as root|was not found|not writable/.test(real),
            `the refusal must explain itself, got: ${real}`,
        );
        assert.ok(!/ENOENT/.test(real), 'a raw spawn error is not an explanation');
    }
}

run_all_tests().then(
    () => {
        process.stdout.write('ALL_TESTS_PASSED\n');
        process.exit(0);
    },
    (error) => {
        process.stdout.write(`${error && error.stack ? error.stack : error}\n`);
        process.exit(1);
    },
);
