/**
 * WHAT CAN THIS MACHINE ACTUALLY REACH, and how does it want to be talked
 * to? Run on a server when mail is not arriving, before changing a line of
 * code.
 *
 *   node deploy/mail_check.js                 from the checkout
 *   node /repo/deploy/mail_check.js           inside the backend container
 *   node deploy/mail_check.js mail.example.rw extra host to try
 *
 * It answers three questions in order, because they fail differently and
 * only the first one is about the network:
 *
 *   1. what each backend's .env is actually configured with,
 *   2. whether a TCP connection to the mail server opens AT ALL, port by
 *      port, and what the server says first - the answer that tells you
 *      whether it speaks TLS or plain text,
 *   3. which way of connecting the server accepts the credentials on.
 *
 * ETIMEDOUT on CONN - the error that sent me here - is question 2 failing.
 * No setting fixes it: nothing was reachable. A password is never printed.
 */

const fs = require("fs");
const net = require("net");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BACKENDS = ["backend", "em_backend", "dc_backend"];
const PORTS = [587, 465, 25];
// Known candidates for this deployment, on top of whatever the envs name.
const KNOWN_HOSTS = ["197.243.27.181", "mail.kigalicity.gov.rw"];
const TCP_WAIT = 6000;
const VERIFY_WAIT = 10000;

const say = (text) => process.stdout.write(`${text}\n`);
const head = (text) => say(`\n== ${text}`);

// nodemailer lives in whichever install is at hand: the container's own, or
// one of the three backends in the checkout.
function load_nodemailer() {
  const tries = [
    "/app/node_modules/nodemailer",
    ...BACKENDS.map((name) => path.join(ROOT, name, "node_modules", "nodemailer")),
    "nodemailer",
  ];
  for (const where of tries) {
    try {
      return require(where);
    } catch (error) {
      /* the next one */
    }
  }
  return null;
}

function read_env(file) {
  const held = {};
  if (!fs.existsSync(file)) return null;
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return;
      let value = match[2].trim();
      if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
      held[match[1]] = value;
    });
  return held;
}

// What is configured, and where the account comes from.
function report_envs() {
  head("What each backend is configured with");
  const accounts = [];
  BACKENDS.forEach((name) => {
    const env = read_env(path.join(ROOT, name, ".env"));
    if (!env) {
      say(`   ${name.padEnd(11)} no .env in the checkout`);
      return;
    }
    const host = env.EMAIL_HOST || "(unset - the code's own default)";
    const port = env.EMAIL_PORT || "(unset)";
    const user = env.EMAIL_USER || "(unset - the server will refuse every message)";
    const secure = env.EMAIL_SECURE === undefined ? "(unset - found out at runtime)" : env.EMAIL_SECURE;
    say(`   ${name.padEnd(11)} ${host}:${port}  as ${user}`);
    say(`   ${"".padEnd(11)} EMAIL_SECURE ${secure}, password ${env.EMAIL_PASS ? "set" : "NOT SET"}, from ${env.EMAIL_FROM || "(unset)"}`);
    if (env.EMAIL_USER && env.EMAIL_PASS) accounts.push({ name, user: env.EMAIL_USER, pass: env.EMAIL_PASS });
  });
  // The environment this process is actually running with wins over any
  // file, which is what a container does.
  if (process.env.EMAIL_HOST || process.env.EMAIL_USER) {
    say(`   running env   ${process.env.EMAIL_HOST || "(unset)"}:${process.env.EMAIL_PORT || "(unset)"} as ${process.env.EMAIL_USER || "(unset)"}`);
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      accounts.unshift({ name: "running env", user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS });
    }
  }
  return accounts;
}

function hosts_to_try(extra) {
  const found = [];
  BACKENDS.forEach((name) => {
    const env = read_env(path.join(ROOT, name, ".env"));
    if (env && env.EMAIL_HOST) found.push(env.EMAIL_HOST);
  });
  if (process.env.EMAIL_HOST) found.push(process.env.EMAIL_HOST);
  return [...new Set([...found, ...KNOWN_HOSTS, ...extra].filter(Boolean))];
}

// Does a TCP connection open, and what does the server say first? The first
// bytes settle whether it is speaking TLS (unreadable) or plain text (a 220
// line), which is the thing no amount of reasoning about port numbers can.
function knock(host, port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect(port, host);
    let done = false;
    const finish = (outcome) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ ...outcome, ms: Date.now() - started });
    };
    socket.setTimeout(TCP_WAIT);
    socket.on("connect", () => {
      // Open, but say nothing yet: a greeting may still be coming.
    });
    socket.on("data", (chunk) => {
      const text = chunk.toString("binary");
      const readable = /^[\x20-\x7e\r\n\t]+$/.test(text);
      finish({ open: true, greeting: text.split(/\r?\n/)[0].slice(0, 70), plain: readable });
    });
    socket.on("timeout", () => finish({ open: socket.writable, greeting: null, plain: null, note: "opened but said nothing" }));
    socket.on("error", (error) => finish({ open: false, error: error.code || error.message }));
  });
}

async function report_reachability(hosts) {
  head("Can this machine reach a mail server at all");
  const reachable = [];
  for (const host of hosts) {
    for (const port of PORTS) {
      const result = await knock(host, port);
      const where = `${host}:${port}`.padEnd(32);
      if (result.open && result.greeting) {
        say(`   OPEN     ${where} ${result.ms} ms  says: ${JSON.stringify(result.greeting)}`);
        reachable.push({ host, port, plain: result.plain });
      } else if (result.open) {
        say(`   open     ${where} ${result.ms} ms  ${result.note || "no greeting"} - a mail server would have greeted`);
        reachable.push({ host, port, plain: null });
      } else {
        say(`   blocked  ${where} ${result.ms} ms  ${result.error}`);
      }
    }
  }
  if (!reachable.length) {
    say("\n   NOTHING is reachable from this machine. This is the ETIMEDOUT on CONN:");
    say("   the mail is not being refused, the connection is not being made. It is a");
    say("   firewall, a route or a wrong address - no code change can reach past it.");
  }
  return reachable;
}

function with_timeout(promise, ms, label) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, why: `gave up after ${ms} ms` }), ms + 1000);
    promise.then(
      () => { clearTimeout(timer); resolve({ ok: true }); },
      (error) => { clearTimeout(timer); resolve({ ok: false, why: `${error.code || "no code"}: ${error.message}`, label }); },
    );
  });
}

async function report_modes(reachable, accounts, nodemailer) {
  head("Which way the server accepts the credentials");
  if (!nodemailer) {
    say("   nodemailer is not installed anywhere this script can see, so this part is skipped.");
    return [];
  }
  if (!accounts.length) {
    say("   No EMAIL_USER and EMAIL_PASS anywhere, so there is nothing to sign in with.");
    return [];
  }
  if (!reachable.length) {
    say("   Skipped: nothing was reachable, so there is nothing to sign in to.");
    return [];
  }
  const account = accounts[0];
  say(`   signing in as ${account.user} (from ${account.name})\n`);
  const accepted = [];
  for (const { host, port } of reachable) {
    const ways = [
      ["secure:true   TLS from the first byte", { secure: true }],
      ["secure:false  STARTTLS required      ", { secure: false, requireTLS: true }],
      ["secure:false  STARTTLS if offered    ", { secure: false }],
    ];
    for (const [label, extra] of ways) {
      const transport = nodemailer.createTransport({
        host,
        port,
        auth: { user: account.user, pass: account.pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: VERIFY_WAIT,
        greetingTimeout: VERIFY_WAIT,
        socketTimeout: VERIFY_WAIT + 5000,
        ...extra,
      });
      const started = Date.now();
      const outcome = await with_timeout(transport.verify(), VERIFY_WAIT + 5000, label);
      const ms = Date.now() - started;
      if (outcome.ok) {
        say(`   ACCEPTED ${host}:${port}  ${label}  ${ms} ms`);
        accepted.push({ host, port, secure: extra.secure });
        break;
      }
      say(`   refused  ${host}:${port}  ${label}  ${ms} ms  ${outcome.why}`);
    }
  }
  return accepted;
}

function verdict(accepted) {
  head("What to do");
  if (!accepted.length) {
    say("   No combination of host, port and mode was accepted from this machine.");
    say("   The next step is the network, not the code: ask whether outbound SMTP is");
    say("   permitted from this server, and confirm the address and port of the mail");
    say("   server with whoever runs it. Nothing in these backends can talk its way");
    say("   past a dropped connection.");
    return;
  }
  const best = accepted[0];
  say(`   Put these in deploy/env/shared.env and deploy - they are the settings this`);
  say(`   machine just proved, not settings anybody reasoned about:\n`);
  say(`     EMAIL_HOST=${best.host}`);
  say(`     EMAIL_PORT=${best.port}`);
  say(`     EMAIL_SECURE=${best.secure ? "true" : "false"}`);
  if (accepted.length > 1) {
    say(`\n   Also accepted: ${accepted.slice(1).map((entry) => `${entry.host}:${entry.port} (secure ${entry.secure})`).join(", ")}`);
  }
  say(`\n   The main backend's own mailer has secure hard-coded in`);
  say(`   backend/utilities/email.js - if the proven answer above disagrees with it,`);
  say(`   that ONE line is the change, and nothing else.`);
}

(async () => {
  say(`Mail check, ${new Date().toISOString()}`);
  say(`checkout: ${ROOT}`);
  const nodemailer = load_nodemailer();
  const accounts = report_envs();
  const reachable = await report_reachability(hosts_to_try(process.argv.slice(2)));
  const accepted = await report_modes(reachable, accounts, nodemailer);
  verdict(accepted);
  say("");
  process.exit(0);
})();
