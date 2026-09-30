// THE ADDRESS THE SYSTEM SENDS FROM, however EMAIL_FROM is written.
//
// A From header may carry a display name ("IKAZE <a@b>") or not ("<a@b>",
// "a@b"). The deployment writes the bare address, so the system's own name
// is put in front of it here; an EMAIL_FROM that already carries a name is
// left exactly as it is. Without this the mail arrives showing nothing but
// an address.
// How the connection to the mail server starts. Port 465 answers with TLS
// from the first byte; 587 - the city's submission port - answers in the
// clear and STARTTLS upgrades it afterwards. EMAIL_SECURE settles it when
// the port is not a reliable guide, which on this network it has not been:
// the same address has wanted different answers from a workstation and
// from a container. A wrong answer here costs one extra attempt and not
// the mail, because utilities/mail_transport.js tries the other way by
// itself (and remembers which one the server accepted).
const mail_secure = (value, port) => {
  const held = String(value || "").trim().toLowerCase();
  if (held === "true" || held === "1" || held === "yes") return true;
  if (held === "false" || held === "0" || held === "no") return false;
  return Number(port) === 465;
};

const mail_from = (value) => {
  const held = String(value || "").trim();
  // Nothing, or something that is not an address at all: the system's own.
  // Without this last test a stray EMAIL_FROM of "IKAZE" would be turned
  // into "IKAZE <IKAZE>" and the mail server would refuse every message -
  // and refuse it on the FIRST send rather than at startup, which is the
  // hardest kind of fault to find.
  if (!held || held.indexOf("@") < 0) return "IKAZE <coksystems@kigalicity.gov.rw>";
  if (/^[^<]+</.test(held)) return held;
  return `IKAZE ${held.startsWith("<") ? held : `<${held}>`}`;
};
const DC_CONFIG = {
  port: process.env.DC_PORT || 8765,
  jwt_secret: process.env.JWT_SECRET || "cok-jwt-secret-2026",
  connection_string: process.env.conne_string || "mongodb://localhost:27017/data_collection_system",
  cok_database_name: process.env.COK_DB_NAME || "cok",
  // Base URL of the main backend, used for server-to-server calls (in-app approval notifications).
  cok_api_url: process.env.COK_API_URL || "http://localhost:2026/cok/api",
  // Browser origins allowed to call this API: CLIENT_URL_SET holds one or
  // several, separated by commas (the production frontend has more than one host).
  client_url_set: process.env.CLIENT_URL_SET
    ? process.env.CLIENT_URL_SET.split(",").map((origin) => origin.trim().replace(/\/+$/, "")).filter(Boolean)
    : ["https://cok-fr.vercel.app", "http://localhost:5173", "http://localhost:3000"],
  upload_dir: "uploads",
  email: {
    // The City's outgoing mail server: 197.243.27.181 on port 587 with
    // STARTTLS and SMTP authentication (see utilities/approval_email.js).
    host: process.env.EMAIL_HOST || "197.243.27.181",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: mail_secure(process.env.EMAIL_SECURE, Number(process.env.EMAIL_PORT) || 587),
    // The name this backend gives the mail server when it says EHLO. Empty
    // means the machine's own name, which in a container is a random id.
    helo: (process.env.EMAIL_HELO_NAME || "").trim(),
    // How long this mail server is allowed to take, for connecting, for
    // greeting and for each answer. The default is the value the main
    // backend was proven to need on this network, where checking a password
    // takes thirty-eight seconds.
    patience: Number(process.env.EMAIL_TIMEOUT_MS) || 655000,
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
    from: mail_from(process.env.EMAIL_FROM),
  },
  max_upload_size_mb: 9999999999999999999999999999999999999999999999,
  max_request_body_size: "40tb",
  // Generous ceilings for legitimate large forms - NOT meant to be truly
  // unlimited. These guard recursive traversals (group nesting, JSONLogic
  // rule-depth measurement) against a stack overflow from a pathological
  // payload; raising them further only trades safety for no real benefit,
  // since no real form design ever approaches these depths.
  max_group_nesting_depth: 50,
  max_jsonlogic_rule_size: 200000,
  max_jsonlogic_rule_depth: 50,
};

module.exports = DC_CONFIG;
