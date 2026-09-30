const assert = require("assert");
const fs = require("fs");
const path = require("path");

/**
 * THE THREE MAILERS MUST BE THE SAME MAILER.
 *
 * One backend sent mail and two did not, for weeks, because each had its
 * own idea of how to open a connection - and every idea was arrived at by
 * reasoning about port numbers rather than by watching a server. What
 * finally worked was measured on the server, by hand: plain text on 587
 * upgraded with STARTTLS, and timeouts long enough to sit through a
 * password check that takes thirty-eight seconds (the transcript is in
 * section 11.27 of dashboards/changes-and-creations.md).
 *
 * This test reads the three mailers as TEXT. It deliberately does not load
 * them: requiring any of them opens a real connection to the city's mail
 * server at startup, which a test must never do. What it guards is that
 * nobody quietly re-introduces the settings that failed - `secure: true`,
 * or a timeout short enough to cut the sign-in in half - in one backend
 * while the others keep working, which is the exact shape of the fault
 * that cost this project a week.
 */

const ROOT = path.join(__dirname, "..", "..");
const say = (text) => process.stdout.write(`${text}\n`);

const MAILERS = [
  ["backend", "backend/utilities/email.js"],
  ["em_backend", "em_backend/utilities/email.js"],
  ["dc_backend", "dc_backend/utilities/approval_email.js"],
];

// Exactly what the server was proven to accept. A value here is not a
// preference; it is a measurement.
const REQUIRED = [
  [/secure:\s*false/, "secure: false - port 587 answers in plain text, so TLS from the first byte is refused in 42 ms"],
  [/requireTLS:\s*true/, "requireTLS: true - STARTTLS must be mandatory, or the credentials could go out in the clear"],
  [/rejectUnauthorized:\s*false/, "tls.rejectUnauthorized: false - the server is an IP address and no certificate can name one"],
  [/connectionTimeout:\s*6550000/, "connectionTimeout: 6550000"],
  [/greetingTimeout:\s*6550000/, "greetingTimeout: 6550000"],
  [/socketTimeout:\s*655000/, "socketTimeout: 655000 - anything under 38 s cuts the sign-in in half"],
];

const FORBIDDEN = [
  [/secure:\s*true/, "secure: true was tried twice and refused twice by this server"],
  [/require\(['"]\.\/mail_transport['"]\)/, "the way-finding transport was removed: all three mailers hold the proven settings directly"],
];

function test_every_mailer_holds_the_proven_settings() {
  MAILERS.forEach(([name, relative]) => {
    const file = path.join(ROOT, relative);
    assert.ok(fs.existsSync(file), `${relative} is missing - every backend must have its mailer`);
    const text = fs.readFileSync(file, "utf8");
    REQUIRED.forEach(([pattern, why]) => {
      assert.ok(pattern.test(text), `${name} is missing ${why}`);
    });
    FORBIDDEN.forEach(([pattern, why]) => {
      assert.ok(!pattern.test(text), `${name} contains what must not be there: ${why}`);
    });
    say(`  ok  ${name} holds the settings the server was proven to accept`);
  });
}

function test_the_account_comes_from_the_environment() {
  // The host, the port and the account are the same five values in all
  // three, and they come from the environment - not from a literal that
  // one backend can be left behind on.
  const configs = [
    ["backend", "backend/configurations/config.js"],
    ["em_backend", "em_backend/configurations/config.js"],
    ["dc_backend", "dc_backend/configurations/config.js"],
  ];
  configs.forEach(([name, relative]) => {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM"].forEach((key) => {
      assert.ok(text.includes(`process.env.${key}`), `${name}/configurations/config.js does not read ${key}`);
    });
    // And no key that nothing consumes any more.
    ["EMAIL_SECURE", "EMAIL_HELO_NAME", "EMAIL_TIMEOUT_MS"].forEach((key) => {
      assert.ok(!text.includes(key), `${name} still reads ${key}, which no mailer uses - dead settings mislead whoever comes next`);
    });
    say(`  ok  ${name} reads the same five EMAIL_ values and nothing dead`);
  });
}

async function run_all_tests() {
  test_every_mailer_holds_the_proven_settings();
  test_the_account_comes_from_the_environment();
}

// No process.exit: on Windows it discards output that has not yet been
// flushed to a file or a pipe, which once made a passing test look like a
// silent crash.
run_all_tests().then(
  () => {
    process.stdout.write("ALL_TESTS_PASSED\n");
    process.exitCode = 0;
  },
  (error) => {
    process.stdout.write(`${error && error.stack ? error.stack : error}\n`);
    process.exitCode = 1;
  },
);
