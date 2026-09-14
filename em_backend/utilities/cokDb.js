const mongoose = require('mongoose');
const config = require('../configurations/config');

/**
 * Read handle into the main system's "cok" database on the same cluster:
 * users (authentication), roles (navigation = access) and the shared
 * "audits" collection. Opened lazily once and reused.
 */

let connection = null;

function getCokConnection() {
  if (connection) return connection;
  connection = mongoose.createConnection(config.database.url, { dbName: config.cokDbName });
  connection.on('error', (error) => console.error('[COK DB] connection error:', error.message));
  return connection;
}

async function cokCollection(name) {
  const conn = getCokConnection();
  if (conn.readyState !== 1) await conn.asPromise();
  return conn.collection(name);
}

module.exports = { getCokConnection, cokCollection };
