/**
 * ONE way of reaching the mail server, shared by every message a backend
 * sends. Identical copy in backend/, em_backend/ and dc_backend/.
 *
 * HOW the connection starts cannot honestly be decided in source, and it
 * has been changed back and forth in this file's neighbours more than
 * once. Port 465 answers with TLS from the first byte. Port 587 - the
 * submission port - answers in the clear and STARTTLS upgrades it
 * afterwards. A server behind a relay, a firewall or a mail appliance can
 * want either on either port, and the answer has already differed between
 * this city's workstations and its containers. Guessing wrong does not
 * make the mail worse: it stops the mail completely, and silently, because
 * a failed handshake is indistinguishable from a mail server that is down.
 *
 * So nothing is guessed here. A message is tried the way the environment
 * asks for, and if the CONNECTION fails - refused, timed out, or a TLS
 * handshake against a port that is not speaking TLS - the same message is
 * tried the other way before anybody is told it could not be sent.
 * Whichever way the server answered is remembered for the life of the
 * process, so the extra attempt is paid once and not per message. Every
 * attempt is logged, so the log says how the server wants to be talked to
 * instead of leaving it to be worked out again.
 *
 * A refusal that is NOT about the connection - wrong password, unknown
 * recipient, message too large - is not retried. Trying the same
 * credentials a second way would only slow down the answer.
 */

const path = require("path");
const nodemailer = require("nodemailer");
const config = require("../configurations/config");

// backend, em_backend or dc_backend - so a line in a shared log says which
// service is speaking without three copies of this file differing.
const SERVICE = path.basename(path.resolve(__dirname, ".."));

const WAYS = {
  tls_first: { label: "TLS from the first byte (as port 465 does)", extra: { secure: true } },
  // Encryption is required, not merely attempted: without requireTLS,
  // nodemailer would fall back to sending the credentials in the clear.
  starttls: { label: "in the clear, then STARTTLS (required)", extra: { secure: false, requireTLS: true } },
  // Last resort. A server that does not advertise STARTTLS refuses every
  // message while requireTLS is on, and refusing to send at all is worse
  // than sending the way that server asks for.
  plain: { label: "in the clear, STARTTLS only if offered", extra: { secure: false } },
};

const ORDER = config.email.secure ? ["tls_first", "starttls", "plain"] : ["starttls", "plain", "tls_first"];

const options_for = (key) => ({
  host: config.email.host,
  port: config.email.port,
  // The server wants SMTP authentication, so a missing EMAIL_USER is a
  // misconfiguration rather than a reason to sign in anonymously: empty
  // credentials are refused on every single send, which reads as "mail
  // silently does not arrive" instead of "mail is not configured".
  auth: config.email.user ? { user: config.email.user, pass: config.email.pass } : undefined,
  tls: {
    // Reached by IP address, and a certificate cannot name an IP, so the
    // name check can never pass. The connection is still encrypted; only
    // the identity of the far end goes unverified.
    rejectUnauthorized: false,
  },
  // Without these, a mail server that is up but not answering keeps the
  // socket open until the operating system gives up, and whatever request
  // is waiting for the mail hangs with it.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  ...WAYS[key].extra,
});

const built = new Map();
const transport_for = (key) => {
  if (!built.has(key)) built.set(key, nodemailer.createTransport(options_for(key)));
  return built.get(key);
};

// The way that last worked. Remembered, not assumed.
let settled = null;

const CONNECTION_CODES = new Set(["ESOCKET", "ETIMEDOUT", "ECONNECTION", "ECONNREFUSED", "EPROTOCOL", "EDNS", "ETLS"]);
const about_the_connection = (error) => {
  if (!error) return false;
  if (CONNECTION_CODES.has(error.code)) return true;
  return /wrong version number|greeting never received|socket close|unexpected socket|ssl routines|handshake/i.test(String(error.message || ""));
};

const attempt_order = () => (settled ? [settled, ...ORDER.filter((key) => key !== settled)] : ORDER.slice());

// Walks the ways until one of them works. `act` is what to do with a
// transport: send the message, or merely verify the connection.
const through_a_working_way = async (act, what) => {
  const keys = attempt_order();
  let last = null;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    try {
      const result = await act(transport_for(key));
      if (settled !== key) {
        settled = key;
        console.log(`[MAIL] ${SERVICE}: ${config.email.host}:${config.email.port} answers ${WAYS[key].label}`);
      }
      return result;
    } catch (error) {
      last = error;
      if (settled === key) settled = null;
      const more = index + 1 < keys.length;
      if (!more || !about_the_connection(error)) break;
      console.warn(`[MAIL] ${SERVICE}: ${WAYS[key].label} did not connect (${error.code || "no code"}: ${error.message}) - trying ${WAYS[keys[index + 1]].label} for this ${what}`);
    }
  }
  throw last || new Error("the mail server could not be reached");
};

const sendMail = (message) => through_a_working_way((transport) => transport.sendMail(message), "message");

// Nodemailer's verify takes a callback, and the mailers call it that way at
// startup, so both shapes are kept.
const verify = (callback) => {
  const walk = through_a_working_way((transport) => transport.verify(), "check");
  if (typeof callback !== "function") return walk;
  walk.then(() => callback(null, true), (error) => callback(error));
  return undefined;
};

if (!config.email.user) {
  console.warn(`[MAIL] ${SERVICE}: EMAIL_USER is not set in ${SERVICE}/.env - the mail server requires SMTP authentication, so no mail will be accepted.`);
}

module.exports = { sendMail, verify, service: SERVICE };
