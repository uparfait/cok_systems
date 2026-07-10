const mongoose = require("mongoose");

/**
 * Runs a callback inside a MongoDB transaction only when the deployment
 * supports them (replica set member or mongos). Standalone `mongod`
 * instances throw:
 *   "Transaction numbers are only allowed on a replica set member or mongos"
 * so in that case we fall back to executing without a transaction.
 *
 * callback receives (session) where `session` is null when no transaction
 * is used. Always pass `{ session }` to mongoose queries/saves.
 */
async function withTransaction(callback, options = {}) {
  const client = mongoose.connection?.client;
  const topology = client?.topology;
  const topologyType = topology?.description?.type;

  const supportsTransactions =
    topologyType === "ReplicaSetWithPrimary" ||
    topologyType === "Sharded" ||
    topologyType === "LoadBalanced";

  if (!supportsTransactions) {
    return callback(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction(options);

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = withTransaction;
