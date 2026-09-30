const assert = require("assert");
const net = require("net");
const path = require("path");

/**
 * THE SHARED MAIL TRANSPORT (utilities/mail_transport.js, the same file in
 * dc_backend and em_backend), against a mail server that answers in PLAIN
 * TEXT and does not offer STARTTLS.
 *
 * How a connection to this city's mail server has to start is not
 * knowable from the source, and has been changed back and forth in these
 * backends in both directions. A wrong answer does not make the mail
 * worse - it stops the mail, silently, because a failed handshake is
 * indistinguishable from a mail server that is down.
 *
 * So what is tested here is not a setting. It is that a WRONG setting
 * still delivers the message; that the way which worked is remembered
 * rather than rediscovered per message; that the order the environment
 * asks for is respected; and that a mail server which genuinely cannot be
 * reached is still reported rather than swallowed.
 *
 * Nothing leaves the machine: the server is on 127.0.0.1 and every message
 * is read back off the socket.
 */

const TRANSPORT = path.join(__dirname, "..", "utilities", "mail_transport.js");
const CONFIG = path.join(__dirname, "..", "configurations", "config.js");
const say = (text) => process.stdout.write(`${text}\n`);

// A mail server that speaks plain text only. It advertises AUTH, so the
// credentials are accepted, but NOT STARTTLS - so a transport that insists
// on encryption cannot talk to it either, and both fallback steps are
// exercised rather than only the first.
function plaintext_server(port) {
  const received = [];
  const server = net.createServer((socket) => {
    let in_data = false;
    let body = "";
    socket.write("220 fake.kigalicity.local ESMTP\r\n");
    socket.on("data", (chunk) => {
      const text = chunk.toString();
      if (in_data) {
        body += text;
        if (/\r\n\.\r\n$/.test(body)) {
          in_data = false;
          received.push(body);
          body = "";
          socket.write("250 2.0.0 Ok: queued as TEST\r\n");
        }
        return;
      }
      text.split(/\r\n/).filter(Boolean).forEach((line) => {
        const verb = line.split(" ")[0].toUpperCase();
        if (verb === "EHLO" || verb === "HELO") socket.write("250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 52428800\r\n");
        else if (verb === "AUTH") socket.write("235 2.7.0 ok\r\n");
        else if (verb === "DATA") { in_data = true; socket.write("354 go ahead\r\n"); }
        else if (verb === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 2.0.0 Ok\r\n");
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

async function run_all_tests() {
  await test_a_wrong_setting_still_delivers();
  await test_the_order_asked_for_is_respected();
  await test_an_unreachable_server_is_still_reported();
  await test_a_missing_account_is_said_at_startup();
}

run_all_tests().then(
  () => {
    process.stdout.write("ALL_TESTS_PASSED\n");
    process.exit(0);
  },
  (error) => {
    process.stdout.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  },
);
