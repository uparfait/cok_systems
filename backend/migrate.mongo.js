const mongoose = require("mongoose");

const db_cok_campass_conne =
  "mongodb+srv://cok_systems:kigalicity@coksystems.rldhlb3.mongodb.net/cok?appName=coksystems";
const db_event_campass_conne =
  "mongodb+srv://cok_systems:kigalicity@coksystems.rldhlb3.mongodb.net/COK_EVENT_MNG?appName=coksystems";

const db_cok_prod_conne =
  "mongodb://CoK-IkazeSys:IKaZE%21%402026sys@172.18.0.2:27017/cok?authSource=admin";
const db_event_prod_conne =
  "mongodb://CoK-IkazeSys:IKaZE%21%402026sys@172.18.0.2:27017/COK_EVENT_MNG?authSource=admin";

async function migrateData() {
  let atlasConn, prodConn;

  try {
    // 1. Establish Connections
    console.log("Connecting to Atlas MongoDB...");
    atlasConn = await mongoose.createConnection(db_cok_campass_conne, {
      maxPoolSize: 10,
      minPoolSize: 2,
    }).asPromise();

    console.log("Connecting to Production MongoDB...");
    prodConn = await mongoose.createConnection(db_cok_prod_conne, {
      maxPoolSize: 10,
      minPoolSize: 2,
    }).asPromise();

    // 2. Get Native DB Instances
    // For the default DB in the URI
    const db1Src = atlasConn.db; 
    const db1Dest = prodConn.db;

    // For the secondary DB, use .useDb().db to get the native driver instance
    const db2Src = atlasConn.useDb('COK_EVENT_MNG').db;
    const db2Dest = prodConn.useDb('COK_EVENT_MNG').db;

    // 3. Helper to migrate collections between two native DBs
    const migrateCollections = async (srcDb, destDb, dbNameLabel) => {
      console.log(`Starting migration for ${dbNameLabel}...`);
      
      // listCollections() returns a cursor, toArray() resolves it
      const collections = await srcDb.listCollections().toArray();

      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;
        
        // Skip system collections
        if (collectionName.startsWith('system.')) continue;

        const srcCollection = srcDb.collection(collectionName);
        const destCollection = destDb.collection(collectionName);

        // Check if collection exists in destination
        const existing = await destDb.listCollections({ name: collectionName }).toArray();
        if (existing.length === 0) {
          await destDb.createCollection(collectionName);
        }

        // Migrate in batches
        const batchSize = 1000;
        let skip = 0;
        let totalMigrated = 0;

        while (true) {
          const data = await srcCollection.find().skip(skip).limit(batchSize).toArray();
          if (data.length === 0) break;

          // Use ordered: false to continue on duplicate key errors if re-running
          await destCollection.insertMany(data, { ordered: false }).catch(err => {
            if (err.code !== 11000) throw err; // Ignore duplicate key errors
          });
          
          totalMigrated += data.length;
          skip += batchSize;
          console.log(`  [${dbNameLabel}] ${collectionName}: migrated ${totalMigrated} docs`);
        }
      }
    };

    // 4. Execute Migrations
    await migrateCollections(db1Src, db1Dest, "DB1 (cok)");
    await migrateCollections(db2Src, db2Dest, "DB2 (COK_EVENT_MNG)");

    console.log("✅ Data migration completed successfully.");

  } catch (error) {
    console.error("❌ Error during data migration:", error);
    process.exitCode = 1;
  } finally {
    // 5. Clean up connections
    if (atlasConn) await atlasConn.close();
    if (prodConn) await prodConn.close();
    console.log("Connections closed.");
  }
}

migrateData();