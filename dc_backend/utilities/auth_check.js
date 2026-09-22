const config = require("../configurations/config.js");
const { get_cok_db } = require("../db_connection/db.js");

/**
 * Says at startup whether sign-in can work on this server.
 *
 * This service never issues tokens: it verifies the main backend's token
 * with the same JWT_SECRET and then loads the account from the main
 * system's "cok" database on ITS OWN Mongo connection. Sign-in therefore
 * breaks silently when either setting differs from the main backend's -
 * a different secret makes every token "invalid signature", a different
 * Mongo server makes every account "not found". Both are checked here and
 * written to the log in plain words, so a deployment shows the cause the
 * moment the container starts instead of when the first user is refused.
 */
const DEFAULT_SECRET = "cok-jwt-secret-2026";
const TAG = "[AUTH CHECK]";

function mongo_host(connection_string) {
  const text = String(connection_string || "");
  const after_scheme = text.replace(/^[a-z+]+:\/\//i, "");
  const without_credentials = after_scheme.includes("@") ? after_scheme.slice(after_scheme.lastIndexOf("@") + 1) : after_scheme;
  return without_credentials.split(/[/?]/)[0];
}

async function run_auth_check() {
  if (!process.env.JWT_SECRET) {
    console.warn(`${TAG} JWT_SECRET is not set: using the development default. The main backend must use the same value or every token is refused.`);
  } else if (process.env.JWT_SECRET === DEFAULT_SECRET) {
    console.warn(`${TAG} JWT_SECRET is the development default. Fine only if the main backend uses it too.`);
  } else {
    console.log(`${TAG} JWT_SECRET is set (${process.env.JWT_SECRET.length} characters). It must be identical in backend/.env.`);
  }

  const host = mongo_host(config.connection_string);
  const db_name = config.cok_database_name;
  try {
    const cok = get_cok_db();
    const [users, roles] = await Promise.all([cok.collection("users").countDocuments(), cok.collection("roles").countDocuments()]);
    console.log(`${TAG} Accounts are read from database '${db_name}' on ${host}: ${users} users, ${roles} roles.`);
    if (users === 0) {
      console.warn(`${TAG} That database has NO users, so nobody can sign in here. Point conne_string at the same Mongo server the main backend uses (its conne_string), and COK_DB_NAME at its database (usually 'cok').`);
    }
    return { users, roles, host, db_name };
  } catch (error) {
    console.warn(`${TAG} Could not read database '${db_name}' on ${host}: ${error.message}. Sign-in will fail until this connection works.`);
    return null;
  }
}

module.exports = { run_auth_check, mongo_host };
