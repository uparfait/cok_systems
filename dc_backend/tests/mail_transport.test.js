const assert = require("assert");
const net = require("net");
const path = require("path");

/**
 * THE SHARED MAIL TRANSPORT (utilities/mail_transport.js, the same file in
 * dc_backend and em_backend), against the two things this city's mail
 * server actually does.
 *
 * It answers in PLAIN TEXT on its submission port, so a connection opened
 * in TLS is refused in 42 milliseconds - and it takes THIRTY-EIGHT SECONDS
 * to check a password, so a mailer that gives up after 15 is cut off in the
 * middle of signing in and reports a timeout. Both failures look identical
 * from inside the application: no mail, and no reason.
 *
 * So what is tested here is not a setting. It is that a WRONG setting still
 * delivers the message; that the way which worked is remembered rather than
 * rediscovered per message; that the order the environment asks for is
 * respected; that a mail server which genuinely cannot be reached is still
 * reported rather than swallowed; and that a SLOW sign-in is waited out and
 * then paid once rather than once per message.
 *
 * Nothing leaves the machine: every server is on 127.0.0.1 and every
 * message is read back off the socket.
 */

const TRANSPORT = path.join(__dirname, "..", "utilities", "mail_transport.js");
const CONFIG = path.join(__dirname, "..", "configurations", "config.js");
const say = (text) => process.stdout.write(`${text}\n`);
const CRLF = "\r\n";

// A mail server that speaks plain text only. It advertises AUTH, so the
// credentials are accepted, but NOT STARTTLS - so a transport that insists
// on encryption cannot talk to it either, and both fallback steps are
// exercised rather than only the first.
function plaintext_server(port) {
  const received = [];
  const server = net.createServer((socket) => {
    let in_data = false;
    let body = "";
    socket.write(`220 fake.kigalicity.local ESMTP${CRLF}`);
    socket.on("data", (chunk) => {
      const text = chunk.toString();
      if (in_data) {
        body += text;
        if (/\r\n\.\r\n$/.test(body)) {
          in_data = false;
          received.push(body);
          body = "";
          socket.write(`250 2.0.0 Ok: queued as TEST${CRLF}`);
        }
        return;
      }
      text.split(/\r\n/).filter(Boolean).forEach((line) => {
        const verb = line.split(" ")[0].toUpperCase();
        if (verb === "EHLO" || verb === "HELO") socket.write(`250-fake${CRLF}250-AUTH PLAIN LOGIN${CRLF}250 SIZE 52428800${CRLF}`);
        else if (verb === "AUTH") socket.write(`235 2.7.0 ok${CRLF}`);
        else if (verb === "DATA") { in_data = true; socket.write(`354 go ahead${CRLF}`); }
        else if (verb === "QUIT") { socket.write(`221 bye${CRLF}`); socket.end(); }
        else socket.write(`250 2.0.0 Ok${CRLF}`);
      });
    });
    // A client that hangs up mid-handshake is normal here: that is what a
    // TLS attempt against this server looks like.
    socket.on("error", () => {});
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ server, received }));
  });
}

// A mail server that is slow exactly where this city's is slow: it greets
// at once, offers AUTH, and then sits on the password.
function slow_auth_server(port, hold_ms) {
  const state = { greetings: [], sign_ins: 0, connections: 0, messages: 0 };
  // The thirty-eight seconds that broke everything, in miniature.
  const slowly = (socket) =>
    setTimeout(() => {
      state.sign_ins += 1;
      socket.write(`235 2.7.0 Authentication successful${CRLF}`);
    }, hold_ms);
  const server = net.createServer((socket) => {
    state.connections += 1;
    let stage = "";
    socket.on("error", () => {});
    socket.write(`220 slow.kigalicity.local ESMTP Postfix${CRLF}`);
    socket.on("data", (chunk) => {
      String(chunk)
        .split(/\r\n/)
        .filter((line) => line.length > 0)
        .forEach((line) => {
          const verb = line.split(" ")[0].toUpperCase();
          if (stage === "data") {
            if (line === ".") {
              stage = "";
              state.messages += 1;
              socket.write(`250 2.0.0 Ok: queued${CRLF}`);
            }
            return;
          }
          if (verb === "EHLO" || verb === "HELO") {
            state.greetings.push(line.slice(verb.length + 1));
            socket.write(`250-slow${CRLF}250-AUTH LOGIN PLAIN${CRLF}250 DSN${CRLF}`);
          } else if (verb === "AUTH") {
            // A mailer sends everything at once - "AUTH PLAIN <base64>" -
            // when the server offers PLAIN, and only falls back to the
            // question-and-answer form of LOGIN otherwise. A stand-in that
            // knows only LOGIN answers the wrong thing and the real
            // mailer then waits for an answer that never comes, which is
            // what this test first did to itself.
            const parts = line.split(" ");
            if (parts[1] && parts[1].toUpperCase() === "PLAIN" && parts[2]) {
              slowly(socket);
            } else {
              stage = "user";
              socket.write(`334 VXNlcm5hbWU6${CRLF}`);
            }
          } else if (stage === "user") {
            stage = "pass";
            socket.write(`334 UGFzc3dvcmQ6${CRLF}`);
          } else if (stage === "pass") {
            stage = "";
            slowly(socket);
          } else if (verb === "DATA") {
            stage = "data";
            socket.write(`354 go ahead${CRLF}`);
          } else if (verb === "QUIT") {
            socket.write(`221 bye${CRLF}`);
            socket.end();
          } else {
            socket.write(`250 2.0.0 Ok${CRLF}`);
          }
        });
    });
  });
  server.on("error", () => {});
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, state })));
}

// A transport that has not seen this process's earlier environment.
function load_transport(settings) {
  Object.keys(settings).forEach((key) => { process.env[key] = settings[key]; });
  delete require.cache[require.resolve(CONFIG)];
  delete require.cache[require.resolve(TRANSPORT)];
  return require(TRANSPORT);
}

// What the transport says while it works something out.
function while_listening(work) {
  const said = [];
  const real = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args) => said.push(String(args[0]));
  console.warn = (...args) => said.push(String(args[0]));
  console.error = (...args) => said.push(String(args[0]));
  return work().then(
    (value) => { Object.assign(console, real); return { value, said }; },
    (error) => { Object.assign(console, real); return { error, said }; },
  );
}

const ACCOUNT = {
  EMAIL_HOST: "127.0.0.1",
  EMAIL_USER: "coksystems@kigalicity.gov.rw",
  EMAIL_PASS: "not-a-real-password",
  EMAIL_FROM: "<coksystems@kigalicity.gov.rw>",
  EMAIL_HELO_NAME: "",
  // Short, so a test that goes wrong fails in seconds. In production this
  // is nearly eleven minutes, because this city's mail server needs it.
  EMAIL_TIMEOUT_MS: "8000",
};

const SENDER = "<coksystems@kigalicity.gov.rw>";
const MESSAGE = { to: "someone@kigalicity.gov.rw", subject: "A test", text: "A test" };

async function test_a_wrong_setting_still_delivers() {
  const { server, received } = await plaintext_server(2541);
  try {
    // TLS from the first byte, against a port that answers in the clear.
    const transport = load_transport({ ...ACCOUNT, EMAIL_PORT: "2541", EMAIL_SECURE: "true" });
    const first = await while_listening(() => transport.sendMail({ from: SENDER, ...MESSAGE }));
    assert.ok(!first.error, `the message had to go out anyway, but: ${first.error && first.error.message}`);
    assert.strictEqual(received.length, 1, "the server had to receive exactly one message");
    assert.ok(/someone@kigalicity\.gov\.rw/.test(received[0]), "the recipient had to survive the retry");
    assert.ok(first.said.some((line) => /did not connect/.test(line)), "the failed way had to be said out loud");
    assert.ok(first.said.some((line) => /answers in the clear/.test(line)), "the way that worked had to be named");
    say("  ok  a wrong setting still delivers the message");

    // The second message must not repeat the discovery.
    const second = await while_listening(() => transport.sendMail({ from: SENDER, ...MESSAGE }));
    assert.ok(!second.error, "the second message had to go out too");
    assert.strictEqual(received.length, 2, "the server had to receive the second message");
    assert.strictEqual(
      second.said.filter((line) => /did not connect/.test(line)).length,
      0,
      "the working way had to be remembered, not worked out again per message",
    );
    say("  ok  the way that worked is remembered, not rediscovered per message");
  } finally {
    server.close();
  }
}

async function test_the_order_asked_for_is_respected() {
  const { server, received } = await plaintext_server(2542);
  try {
    // STARTTLS first, as port 587 deserves. This server does not offer it,
    // so the transport has to fall through to plain - and must NOT have
    // tried TLS-from-the-first-byte before that.
    const transport = load_transport({ ...ACCOUNT, EMAIL_PORT: "2542", EMAIL_SECURE: "false" });
    const sent = await while_listening(() => transport.sendMail({ from: SENDER, ...MESSAGE }));
    assert.ok(!sent.error, `the message had to go out, but: ${sent.error && sent.error.message}`);
    assert.strictEqual(received.length, 1, "the server had to receive it");
    const tried_tls_first = sent.said.findIndex((line) => /TLS from the first byte/.test(line));
    const settled_on_plain = sent.said.findIndex((line) => /answers in the clear/.test(line));
    assert.ok(settled_on_plain >= 0, "it had to say which way the server answered");
    assert.ok(
      tried_tls_first < 0 || tried_tls_first > settled_on_plain,
      "with EMAIL_SECURE=false, TLS from the first byte must not be tried before the ways that fit the port",
    );
    say("  ok  the order the environment asks for is respected");
  } finally {
    server.close();
  }
}

async function test_an_unreachable_server_is_still_reported() {
  // Nothing is listening on this port. Every way has to be tried and the
  // failure has to reach the caller: a mailer that swallows this is how a
  // reset code was once audited as sent while nothing left the building.
  const transport = load_transport({ ...ACCOUNT, EMAIL_PORT: "2543", EMAIL_SECURE: "true" });
  const attempt = await while_listening(() => transport.sendMail({ from: SENDER, ...MESSAGE }));
  assert.ok(attempt.error, "a server that is not there must not look like a success");
  assert.ok(
    /ECONNREFUSED|ESOCKET|ETIMEDOUT/.test(attempt.error.code || attempt.error.message),
    `the reason must say it was the connection, got: ${attempt.error.code || attempt.error.message}`,
  );
  say("  ok  a server that cannot be reached is reported, not swallowed");
}

async function test_a_missing_account_is_said_at_startup() {
  const said = [];
  const real = console.warn;
  console.warn = (...args) => said.push(String(args[0]));
  load_transport({ ...ACCOUNT, EMAIL_USER: "", EMAIL_PASS: "", EMAIL_PORT: "2544" });
  console.warn = real;
  assert.ok(
    said.some((line) => /EMAIL_USER is not set/.test(line)),
    "a backend with no mail account has to say so when it boots, not once per message that never arrives",
  );
  say("  ok  a missing mail account is said at startup");
}

async function test_a_slow_sign_in_is_survived_and_paid_once() {
  // Longer than the 15 s every backend here used to allow, so this case
  // fails outright on the timeouts this repository had until 2026-09-30.
  const HOLD = 17000;
  const { server, state } = await slow_auth_server(2545, HOLD);
  try {
    const transport = load_transport({
      ...ACCOUNT,
      EMAIL_PORT: "2545",
      EMAIL_SECURE: "false",
      EMAIL_HELO_NAME: "ikaze-sys.kigalicity.gov.rw",
      // Longer than the sign-in below, shorter than a test anybody would
      // wait for. Production allows nearly eleven minutes.
      EMAIL_TIMEOUT_MS: "40000",
    });
    const first_at = Date.now();
    const first = await while_listening(() => transport.sendMail({ from: SENDER, ...MESSAGE }));
    const first_took = Date.now() - first_at;
    assert.ok(!first.error, `a slow sign-in must not lose the message, but: ${first.error && first.error.message}`);
    assert.ok(first_took > HOLD - 2000, `the sign-in should have been waited out, took ${first_took} ms`);
    say(`  ok  a sign-in that takes ${HOLD / 1000} s is waited out, not cut off (${(first_took / 1000).toFixed(1)} s)`);

    // The next message pays the same slow sign-in, because nothing is
    // pooled here - see the comment on that in the transport. What matters
    // is that it ARRIVES: a second message must not inherit a broken
    // connection or a remembered failure from the first.
    const second_at = Date.now();
    const second = await while_listening(() => transport.sendMail({ from: SENDER, ...MESSAGE }));
    const second_took = Date.now() - second_at;
    assert.ok(!second.error, `the second message had to go out too, but: ${second.error && second.error.message}`);
    assert.strictEqual(state.messages, 2, `the server had to receive both messages, it got ${state.messages}`);
    assert.strictEqual(state.sign_ins, 2, `one sign-in per message is expected without a pool, there were ${state.sign_ins}`);
    assert.strictEqual(
      second.said.filter((line) => /did not connect/.test(line)).length,
      0,
      "the way that worked had to be remembered, so the second message does not start over",
    );
    say(`  ok  the next message goes out the remembered way and pays the same sign-in (${(second_took / 1000).toFixed(1)} s)`);

    // And it introduced itself with the name it was given, not the
    // machine's own - which inside a container is a random id.
    assert.ok(
      state.greetings.length > 0 && state.greetings.every((name) => name === "ikaze-sys.kigalicity.gov.rw"),
      `EHLO should carry EMAIL_HELO_NAME, got ${JSON.stringify(state.greetings)}`,
    );
    say("  ok  it says EHLO with the name it was configured with");
  } finally {
    server.close();
  }
}

async function run_all_tests() {
  await test_a_wrong_setting_still_delivers();
  await test_the_order_asked_for_is_respected();
  await test_an_unreachable_server_is_still_reported();
  await test_a_missing_account_is_said_at_startup();
  await test_a_slow_sign_in_is_survived_and_paid_once();
}

// process.exit() is NOT used here. On Windows, output redirected to a file
// or a pipe is written asynchronously, and process.exit() throws away
// whatever has not been flushed - which silently swallowed this file's last
// test and its own verdict, leaving an exit code of 0 and no explanation.
// Setting the code and letting the process end on its own keeps the output.
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
