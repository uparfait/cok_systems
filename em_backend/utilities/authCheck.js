const config = require('../configurations/config');
const { cokCollection } = require('./cokDb');

/**
 * Says at startup whether sign-in can work on this server.
 *
 * This service never issues tokens: it verifies the main backend's token
 * with the same JWT_SECRET and then loads the account from the main
 * system's "cok" database on ITS OWN Mongo connection (DATABASE_URL2).
 * Sign-in therefore breaks silently when either setting differs from the
 * main backend's - a different secret makes every token "invalid
 * signature", a different Mongo server makes every account "not found".
 * Both are checked here and written to the log in plain words, so a
 * deployment shows the cause the moment the container starts.
 * Mirrors dc_backend/utilities/auth_check.js.
 */
const DEFAULT_SECRET = 'cok-jwt-secret-2026';
const TAG = '[AUTH CHECK]';

function mongoHost(connectionString) {
  const text = String(connectionString || '');
  const afterScheme = text.replace(/^[a-z+]+:\/\//i, '');
  const withoutCredentials = afterScheme.includes('@') ? afterScheme.slice(afterScheme.lastIndexOf('@') + 1) : afterScheme;
  return withoutCredentials.split(/[/?]/)[0];
}

async function runAuthCheck() {
  if (!process.env.JWT_SECRET) {
    console.warn(`${TAG} JWT_SECRET is not set: using the development default. The main backend must use the same value or every token is refused.`);
  } else if (process.env.JWT_SECRET === DEFAULT_SECRET) {
    console.warn(`${TAG} JWT_SECRET is the development default. Fine only if the main backend uses it too.`);
  } else {
    console.log(`${TAG} JWT_SECRET is set (${process.env.JWT_SECRET.length} characters). It must be identical in backend/.env.`);
  }

  const host = mongoHost(config.database.url);
  const dbName = config.cokDbName;
  try {
    const [users, roles] = await Promise.all([
      cokCollection('users').then((collection) => collection.countDocuments()),
      cokCollection('roles').then((collection) => collection.countDocuments()),
    ]);
    console.log(`${TAG} Accounts are read from database '${dbName}' on ${host}: ${users} users, ${roles} roles.`);
    if (users === 0) {
      console.warn(`${TAG} That database has NO users, so nobody can sign in here. Point DATABASE_URL2 at the same Mongo server the main backend uses (its conne_string), and COK_DB_NAME at its database (usually 'cok').`);
    }
    return { users, roles, host, dbName };
  } catch (error) {
    console.warn(`${TAG} Could not read database '${dbName}' on ${host}: ${error.message}. Sign-in will fail until this connection works.`);
    return null;
  }
}

module.exports = { runAuthCheck, mongoHost };
