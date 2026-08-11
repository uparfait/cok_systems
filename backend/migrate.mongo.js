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

    const db1Src = atlasConn.db;
    const db1Dest = prodConn.db;

    const db2Src = atlasConn.useDb('COK_EVENT_MNG').db;
    const db2Dest = prodConn.useDb('COK_EVENT_MNG').db;

    const migrateCollections = async (srcDb, destDb, dbNameLabel) => {
      console.log(`Starting migration for ${dbNameLabel}...`);
      
      const collections = await srcDb.listCollections().toArray();

      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;
        
        if (collectionName.startsWith('system.')) continue;

        const srcCollection = srcDb.collection(collectionName);
        const destCollection = destDb.collection(collectionName);

        try {
          await destCollection.drop();
          console.log(`  [${dbNameLabel}] Dropped existing collection: ${collectionName}`);
        } catch (error) {
          if (error.code === 26) {
            console.log(`  [${dbNameLabel}] Collection does not exist: ${collectionName}`);
          } else {
            console.log(`  [${dbNameLabel}] Error dropping collection: ${error.message}`);
          }
        }

        const batchSize = 1000;
        let skip = 0;
        let totalMigrated = 0;

        while (true) {
          const data = await srcCollection.find().skip(skip).limit(batchSize).toArray();
          if (data.length === 0) break;

          await destCollection.insertMany(data, { ordered: false });
          
          totalMigrated += data.length;
          skip += batchSize;
          console.log(`  [${dbNameLabel}] ${collectionName}: migrated ${totalMigrated} docs`);
        }
      }
    };

    await migrateCollections(db1Src, db1Dest, "DB1 (cok)");
    await migrateCollections(db2Src, db2Dest, "DB2 (COK_EVENT_MNG)");

    console.log("Data migration completed successfully.");

  } catch (error) {
    console.error("Error during data migration:", error);
    process.exitCode = 1;
  } finally {
    if (atlasConn) await atlasConn.close();
    if (prodConn) await prodConn.close();
    console.log("Connections closed.");
  }
}

migrateData();