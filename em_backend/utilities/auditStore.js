const { cokCollection } = require('./cokDb');

/**
 * Audit rows of every backend live in ONE collection - "audits" in the main
 * system's "cok" database - so the System Audit page shows them together.
 */

const AUDITS_COLLECTION = 'audits';

async function storeAudit(row) {
  try {
    const audits = await cokCollection(AUDITS_COLLECTION);
    await audits.insertOne(row);
  } catch (error) {
    console.error('[AUDIT] failed to store audit row:', error.message);
  }
}

module.exports = { storeAudit };
