const mongoose = require('mongoose');
const config = require('../configurations/config');

/**
 * Audit rows of every backend live in ONE collection - "audits" in the main
 * system's "cok" database - so the System Audit page shows them together.
 * The event service keeps its own database, so a second connection to the
 * same cluster is opened lazily for this single purpose.
 */

const AUDITS_COLLECTION = 'audits';
let connection = null;

function getConnection() {
  if (connection) return connection;
  connection = mongoose.createConnection(config.database.url, { dbName: config.cokDbName });
  connection.on('error', (error) => console.error('[AUDIT] cok database connection error:', error.message));
  return connection;
}

async function storeAudit(row) {
  try {
    const conn = getConnection();
    if (conn.readyState !== 1) await conn.asPromise();
    await conn.collection(AUDITS_COLLECTION).insertOne(row);
  } catch (error) {
    console.error('[AUDIT] failed to store audit row:', error.message);
  }
}

module.exports = { storeAudit };
