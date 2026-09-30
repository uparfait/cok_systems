/**
 * THE WHOLE CONVERSATION WITH THE MAIL SERVER, line by line, with how long
 * each line took - and if the server will not talk, the same conversation
 * tried the other ways it might want to be started.
 *
 *   node deploy/mail_dialogue.js
 *   node deploy/mail_dialogue.js --name ikaze.kigalicity.gov.rw
 *   node deploy/mail_dialogue.js 197.243.27.181 25
 *   node deploy/mail_dialogue.js --wait 90
 *
 * deploy/mail_check.js answers "does anything work". This answers "WHY
 * not", which is the question left when a server greets a raw socket in
 * 31 ms and then lets a mailer time out. The greeting proves the
 * connection is real, so what follows it is the fault, and there are only
 * four candidates:
 *
 *   1. the server is SLOWER than the 15 s socket timeout every backend
 *      here uses - then the fix is in this repository;
 *   2. it dislikes the name the mailer introduces itself with. Nodemailer
 *      says EHLO <os.hostname()>, which on this server is the bare word
 *      "ikaze-sys"; a strict mail server or an anti-spam appliance will
 *      quietly stall a client whose HELO name is not a full domain name;
 *   3. it wants the older HELO rather than EHLO;
 *   4. none of the above - the conversation is being cut by an anti-spam
 *      front, a relay policy or a middlebox, and the answer belongs to
 *      whoever runs the mail server.
 *
 * Each is tried in turn, on a FRESH connection, because a server that has
 * decided to stall a conversation does not change its mind within it. The
 * first combination that answers is carried through STARTTLS, the TLS
 * upgrade and AUTH LOGIN, and printed as the settings to deploy.
 *
 * It waits 60 seconds a step by default, far longer than any backend
 * would, because the point is the truth and not speed. The password is
 * never printed. Run it ONCE: a mail server fronted like this one - note
 * "proxymta" in its banner, and the multiline "220-" form on port 25 -
 * can block an address that keeps failing handshakes.
 */

const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const tls = require("tls");

const ROOT = path.resolve(__dirname, "..");

function read_env(file) {
  const held = {};
  if (!fs.existsSync(file)) return held;
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

const env = { ...read_env(path.join(ROOT, "backend", ".env")), ...process.env };
const argv = process.argv.slice(2);
const flag = (name) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : null;
};
const has = (name) => argv.includes(`--${name}`);
const positional = argv.filter((value, index) => {
  if (value.startsWith("--")) return false;
  const before = argv[index - 1];
  return !(before === "--name" || before === "--wait");
});

const STEP_WAIT = Number(flag("wait") || 60) * 1000;
const HOST = positional[0] || env.EMAIL_HOST || "197.243.27.181";
const PORT = Number(positional[1] || env.EMAIL_PORT || 587);
const START_IN_TLS = has("tls") || PORT === 465;
// A name a strict mail server will accept: a full domain name. The bare
// machine name is kept as a later attempt, so the transcript SHOWS whether
// the name was the problem instead of leaving it to be believed.
const BARE = os.hostname();
const FQDN = flag("name") || (BARE.includes(".") ? BARE : `${BARE}.kigalicity.gov.rw`);

const began = Date.now();
// How long each step took. The point of the transcript is not only what the
// server says but WHEN: a step slower than a mailer's socket timeout is
// indistinguishable, from inside that mailer, from a server that is down.
const steps = [];
const say = (text) => process.stdout.write(`${text}\n`);
const stamp = () => String(Date.now() - began).padStart(6);
const sent = (line) => say(`${stamp()} ms  >> ${line}`);
const got = (line) => say(`${stamp()} ms  << ${line}`);
const note = (text) => say(`${stamp()} ms  -- ${text}`);

// One conversation. Everything about it is local, so a failed attempt can
// be thrown away whole and the next one started clean.
function conversation() {
  let socket = null;
  let buffer = "";
  let waiting = null;

  const settle = (outcome) => {
    if (!waiting) return;
    const held = waiting;
    waiting = null;
    clearTimeout(held.timer);
    held.resolve({ lines: held.lines, ...outcome });
  };

  const attach = (next_socket) => {
    socket = next_socket;
    buffer = "";
    socket.setTimeout(0);
    socket.on("data", (chunk) => {
      buffer += chunk.toString("binary");
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        got(line);
        if (waiting) waiting.lines.push(line);
        // A reply ends on a line with a SPACE after its code, not a hyphen:
        // "250-STARTTLS" continues, "250 HELP" ends. This is also what
        // makes the wait on port 25 correct, where the banner arrives as
        // "220-..." first and talking early is what gets a client blocked.
        if (waiting && /^\d\d\d /.test(line)) settle({ code: Number(line.slice(0, 3)) });
        newline = buffer.indexOf("\n");
      }
    });
    socket.on("error", (error) => {
      note(`the socket failed: ${error.code || error.message}`);
      settle({ code: 0, failed: error.code || error.message });
    });
    socket.on("close", () => settle({ code: 0, closed: true }));
  };

  const reply = (what) => {
    const from = Date.now();
    return new Promise((resolve) => {
      const lines = [];
      const timer = setTimeout(() => {
        waiting = null;
        note(`NOTHING came back for ${what} in ${STEP_WAIT / 1000} s`);
        resolve({ lines, code: 0, silent: true });
      }, STEP_WAIT);
      waiting = { lines, resolve, timer };
    }).then((answer) => {
      steps.push({ what, ms: Date.now() - from });
      return answer;
    });
  };

  const write = (line, shown) => {
    sent(shown || line);
    socket.write(`${line}\r\n`);
  };

  const open = (host, port, in_tls) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ failed: "the connection did not open in time" }), STEP_WAIT);
      const first = in_tls
        ? tls.connect({ host, port, rejectUnauthorized: false }, () => { clearTimeout(timer); resolve({ ok: true }); })
        : net.connect(port, host, () => { clearTimeout(timer); resolve({ ok: true }); });
      first.on("error", (error) => { clearTimeout(timer); resolve({ failed: error.code || error.message }); });
      attach(first);
    });

  const upgrade = (host) =>
    new Promise((resolve) => {
      const raw = socket;
      raw.removeAllListeners("data");
      raw.removeAllListeners("close");
      raw.removeAllListeners("error");
      const timer = setTimeout(() => resolve({ failed: "the TLS handshake did not finish in time" }), STEP_WAIT);
      const next = tls.connect({ socket: raw, rejectUnauthorized: false, servername: /^[0-9.]+$/.test(host) ? undefined : host }, () => {
        clearTimeout(timer);
        attach(next);
        resolve({ ok: true });
      });
      next.on("error", (error) => { clearTimeout(timer); resolve({ failed: error.code || error.message }); });
    });

  return { open, reply, write, upgrade, close: () => socket && socket.destroy() };
}

// One attempt: open, take the banner, introduce ourselves. Returns what the
// greeting was answered with, or why it was not.
async function attempt({ host, port, in_tls, verb, name }) {
  say("");
  note(`trying ${host}:${port} ${in_tls ? "in TLS from the first byte" : "in the clear"}, saying ${verb} ${name}`);
  const talk = conversation();
  const opened = await talk.open(host, port, in_tls);
  if (opened.failed) {
    note(`the connection itself failed: ${opened.failed}`);
    return { talk, outcome: "unreachable", detail: opened.failed };
  }
  const banner = await talk.reply("the greeting");
  if (banner.silent) {
    talk.close();
    return { talk, outcome: "no_banner" };
  }
  if (banner.closed || banner.failed) {
    talk.close();
    return { talk, outcome: "dropped_at_banner" };
  }
  talk.write(`${verb} ${name}`);
  const greeted = await talk.reply(verb);
  if (greeted.silent || greeted.closed) {
    talk.close();
    return { talk, outcome: "silent_after_banner" };
  }
  if (greeted.code >= 400) {
    talk.close();
    return { talk, outcome: "refused_greeting", detail: greeted.lines[greeted.lines.length - 1] };
  }
  return { talk, outcome: "answered", offered: greeted.lines.map((line) => line.slice(4).toUpperCase()) };
}

// The rest of the conversation, once something has answered: encryption,
// then the credentials.
async function finish(talk, { host, port, in_tls, verb, name }, offered) {
  const has_starttls = offered.some((line) => line.startsWith("STARTTLS"));
  const has_auth = offered.some((line) => line.startsWith("AUTH"));
  note(`it offers STARTTLS: ${has_starttls ? "yes" : "NO"}, AUTH: ${has_auth ? "yes" : "NO"}`);

  let secured = in_tls;
  if (!in_tls && has_starttls) {
    talk.write("STARTTLS");
    const ready = await talk.reply("STARTTLS");
    if (ready.code === 220) {
      const up = await talk.upgrade(host);
      if (up.failed) {
        note(`the TLS upgrade failed: ${up.failed}`);
        say("\nVERDICT: the server offers STARTTLS and then cannot complete it. That is");
        say("its certificate or a middlebox intercepting the handshake, not a setting.");
        return 1;
      }
      note("the connection is encrypted now");
      secured = true;
      talk.write(`${verb} ${name}`);
      const again = await talk.reply(`${verb} after STARTTLS`);
      if (again.silent) {
        say("\nVERDICT: silent once the encryption went up. The conversation is being");
        say("cut, not misconfigured.");
        return 1;
      }
    }
  }

  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    talk.write("QUIT");
    await talk.reply("QUIT");
    say("\nVERDICT: the conversation works. There is no EMAIL_USER or EMAIL_PASS in");
    say("backend/.env to sign in with, so put the account there and run this again.");
    return 1;
  }

  talk.write("AUTH LOGIN");
  const asked = await talk.reply("AUTH LOGIN");
  if (asked.code !== 334) {
    note("the server did not ask for a user name the usual way");
    say("\nVERDICT: it talks, but not AUTH LOGIN. Read the offered AUTH line above and");
    say("tell me which mechanism it wants.");
    return 1;
  }
  talk.write(Buffer.from(env.EMAIL_USER).toString("base64"), "<the user name, base64>");
  const for_pass = await talk.reply("the user name");
  if (for_pass.code !== 334) {
    say("\nVERDICT: it would not take the user name. The account or the mechanism is");
    say("the problem, not the host or the port.");
    return 1;
  }
  talk.write(Buffer.from(env.EMAIL_PASS).toString("base64"), "<the password, base64 - not printed>");
  const verdict = await talk.reply("the password");
  if (verdict.code !== 235) {
    say("\nVERDICT: the conversation works and the ACCOUNT does not. Host, port and");
    say("mode are right; EMAIL_USER or EMAIL_PASS is wrong, or this account may not");
    say("submit from this machine's address.");
    return 1;
  }
  note("the credentials were ACCEPTED");
  talk.write("QUIT");
  await talk.reply("QUIT");

  say("");
  say("VERDICT: THIS WORKS. Put these in deploy/env/shared.env and deploy:");
  say("");
  say(`    EMAIL_HOST=${host}`);
  say(`    EMAIL_PORT=${port}`);
  say(`    EMAIL_SECURE=${in_tls ? "true" : "false"}`);
  say("");
  if (!secured) say("    (unencrypted - this server offered no STARTTLS)");

  // The timing, which is usually the whole story when the settings turn out
  // to be right and the mail still does not arrive.
  const slowest = steps.slice().sort((one, other) => other.ms - one.ms)[0];
  if (slowest) {
    say(`The slowest step was "${slowest.what}" at ${(slowest.ms / 1000).toFixed(1)} s.`);
    if (slowest.ms > 15000) {
      say("");
      say("THAT is the fault, and not the host, the port or the mode. A mailer with a");
      say("15 s socket timeout - which is what every backend in this repository had -");
      say(`is cut off in the middle of that step and reports ETIMEDOUT. The timeouts`);
      say(`have to exceed ${Math.ceil(slowest.ms / 1000)} s, with room to spare, and a pooled`);
      say("connection should be kept so the slow step is paid once and not per message.");
    }
  }
  if (name !== BARE) {
    say("");
    say(`It answered ${verb} ${name}. A mailer introduces itself with the`);
    say(`machine's own name, which here is the bare "${BARE}" and inside a container is`);
    say("a random id. Neither was tried - this attempt succeeded first - so whether the");
    say("name matters is NOT known. Setting it explicitly is the safe choice either way:");
    say("EMAIL_HELO_NAME.");
  }
  if (verb === "HELO") {
    say("It wanted the older HELO rather than EHLO. Tell me and I will set that too.");
  }
  return 0;
}

(async () => {
  say(`Mail dialogue, ${new Date().toISOString()}`);
  say(`account: ${env.EMAIL_USER || "(no EMAIL_USER)"}   patience: ${STEP_WAIT / 1000} s a step`);
  say(`this machine calls itself "${BARE}"; the full name tried first is "${FQDN}"`);

  // In order of what costs least to believe. Each on its own connection.
  const attempts = [
    { host: HOST, port: PORT, in_tls: START_IN_TLS, verb: "EHLO", name: FQDN },
    { host: HOST, port: PORT, in_tls: START_IN_TLS, verb: "HELO", name: FQDN },
    { host: HOST, port: PORT, in_tls: START_IN_TLS, verb: "EHLO", name: BARE },
  ];
  // Port 25 is worth one try when the configured port will not talk: it
  // greeted this server in 4 ms, and a submission port can be closed to
  // relaying while 25 is not.
  if (PORT !== 25) attempts.push({ host: HOST, port: 25, in_tls: false, verb: "EHLO", name: FQDN });

  const seen = [];
  for (const one of attempts) {
    const { talk, outcome, offered, detail } = await attempt(one);
    seen.push({ ...one, outcome, detail });
    if (outcome === "answered") {
      process.exit(await finish(talk, one, offered));
    }
    talk.close();
    if (outcome === "unreachable" && one.port === PORT) {
      // No point trying three ways of greeting a port that will not open.
      break;
    }
  }

  say("");
  say("VERDICT: the server greets and then answers nothing - not EHLO, not HELO,");
  say("not with a full domain name, not with the bare one" + (PORT !== 25 ? ", and not on port 25" : "") + ".");
  say("");
  say("That is as far as this repository can go. The banner proves the connection");
  say("is real, so this is not a host, a port, a mode or a timeout: the mail server");
  say("is accepting the connection and then refusing to speak. On a server fronted");
  say('by "proxymta" that means one of two decisions, and both are made on their');
  say("side, not here:");
  say("");
  say("  - this machine's public address is not permitted to submit mail, or has");
  say("    been blocked for failing handshakes;");
  say("  - submission is only allowed through a different relay, port or account.");
  say("");
  say("What to ask whoever runs the mail (AOS, per the banner proxymta-server.aos.rw):");
  say("");
  say("  1. Is this server's public address allowed to submit SMTP? If it is");
  say("     blocked, unblock it and say what blocked it.");
  say("  2. Which host and port should it submit on, and with which encryption?");
  say("  3. Is coksystems@kigalicity.gov.rw allowed to submit from this address?");
  say("");
  say("Give them this transcript: it is the evidence, timed, from their own server.");
  say("");
  say("Attempts made:");
  seen.forEach((one) => say(`  ${one.host}:${one.port} ${one.verb} ${one.name} -> ${one.outcome}${one.detail ? ` (${one.detail})` : ""}`));
  process.exit(1);
})();
