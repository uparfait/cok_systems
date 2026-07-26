// Migrate MongoDB data + indexes from a source (e.g. local) to a target (server).                        non-system databases

const path = require("path");

// Dependencies live in backend/node_modules, not the repo root
function req(name) {
  try {
    return require(name);
  } catch {
    return require(path.join(__dirname, "..", "backend", "node_modules", name));
  }
}

req("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { MongoClient } = req("mongodb");

const SOURCE_URI = process.env.MIGRATE_SOURCE_URI;
const TARGET_URI = process.env.MIGRATE_TARGET_URI;
const DB_NAME = process.env.MIGRATE_DB_NAME || "";
const BATCH_SIZE = 1000;
const SYSTEM_DBS = ["admin", "config", "local"];

if (!SOURCE_URI || !TARGET_URI) {
  console.error(
    "Missing config. Set MIGRATE_SOURCE_URI and MIGRATE_TARGET_URI in the root .env file."
  );
  process.exit(1);
}

async function migrateCollection(sourceDb, targetDb, name) {
  const source = sourceDb.collection(name);
  const target = targetDb.collection(name);

  let batch = [];
  let total = 0;
  let skipped = 0;

  for await (const doc of source.find()) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      const r = await flush(target, batch);
      total += r.inserted;
      skipped += r.skipped;
      batch = [];
    }
  }
  if (batch.length > 0) {
    const r = await flush(target, batch);
    total += r.inserted;
    skipped += r.skipped;
  }

  // Recreate indexes (the default _id index already exists on the target)
  let indexCount = 0;
  for (const idx of await source.indexes()) {
    if (idx.name === "_id_") continue;
    const { key, name: idxName, v, ns, ...options } = idx;
    await target.createIndex(key, { name: idxName, ...options });
    indexCount++;
  }

  const skippedNote = skipped > 0 ? ` (${skipped} already existed, skipped)` : "";
  console.log(`  ✔ ${name}: ${total} documents${skippedNote}, ${indexCount} indexes`);
}

// ordered:false lets re-runs skip documents that were already copied
// (duplicate _id) instead of aborting the whole batch.
async function flush(target, batch) {
  try {
    const res = await target.insertMany(batch, { ordered: false });
    return { inserted: res.insertedCount, skipped: 0 };
  } catch (err) {
    if (err.code === 11000 || err.writeErrors) {
      const dupes = (err.writeErrors || []).length;
      return { inserted: batch.length - dupes, skipped: dupes };
    }
    throw err;
  }
}

async function migrateDatabase(sourceClient, targetClient, dbName) {
  console.log(`\nDatabase: ${dbName}`);
  const sourceDb = sourceClient.db(dbName);
  const targetDb = targetClient.db(dbName);

  const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
  if (collections.length === 0) {
    console.log("  (no collections)");
    return;
  }

  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    await migrateCollection(sourceDb, targetDb, name);
  }
}

async function main() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    await sourceClient.connect();
    console.log("Connected to source");
    await targetClient.connect();
    console.log("Connected to target");

    let dbNames;
    if (DB_NAME) {
      dbNames = [DB_NAME];
    } else {
      const { databases } = await sourceClient.db().admin().listDatabases();
      dbNames = databases.map((d) => d.name).filter((n) => !SYSTEM_DBS.includes(n));
      console.log(`No MIGRATE_DB_NAME set - migrating all: ${dbNames.join(", ")}`);
    }

    for (const dbName of dbNames) {
      await migrateDatabase(sourceClient, targetClient, dbName);
    }

    console.log("\nMigration complete ✅");
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message || err);
  process.exit(1);
});
