const mongoose = require("mongoose");

const db_cok_campass_conne =
  "mongodb+srv://cok_systems:kigalicity@coksystems.rldhlb3.mongodb.net/cok?appName=coksystems";
const db_event_campass_conne =
  "mongodb+srv://cok_systems:kigalicity@coksystems.rldhlb3.mongodb.net/COK_EVENT_MNG?appName=coksystems";

const db_cok_prod_conne =
  "mongodb://CoK-IkazeSys:IKaZE%21%402026sys@172.18.0.2:27017/cok?authSource=admin";
const db_event_prod_conne =
  "mongodb://CoK-IkazeSys:IKaZE%21%402026sys@172.18.0.2:27017/COK_EVENT_MNG?authSource=admin";

// Use a single connection per MongoDB instance
const getConnections = async () => {
  try {
    // Connect to Atlas (compass) - one connection for both databases
    const atlasConnection = await mongoose.createConnection(db_cok_campass_conne, {
      maxPoolSize: 10,
      minPoolSize: 2,
    }).asPromise();

    console.log("Connected to Atlas MongoDB");

    // Connect to Production - one connection for both databases
    const prodConnection = await mongoose.createConnection(db_cok_prod_conne, {
      maxPoolSize: 10,
      minPoolSize: 2,
    }).asPromise();

    console.log("Connected to Production MongoDB");

    return {
      atlasConnection,
      prodConnection,
      // Get specific databases from the connections
      getDb1Src: () => atlasConnection.db,
      getDb1Dest: () => prodConnection.db,
      getDb2Src: () => atlasConnection.useDb('COK_EVENT_MNG'),
      getDb2Dest: () => prodConnection.useDb('COK_EVENT_MNG'),
    };
  } catch (error) {
    console.error("Error connecting to databases:", error);
    throw error;
  }
};

async function migrateData() {
  let connections = null;
  
  try {
    // Get connections
    connections = await getConnections();
    
    // Get database instances
    const db1Src = connections.getDb1Src();
    const db1Dest = connections.getDb1Dest();
    const db2Src = connections.getDb2Src();
    const db2Dest = connections.getDb2Dest();

    // Get all collections from source databases
    const db1SrcCollections = await db1Src.listCollections().toArray();
    const db2SrcCollections = await db2Src.listCollections().toArray();

    // Migrate data from db1 source to db1 destination
    console.log("Starting migration for DB1 (cok)...");
    for (const collection of db1SrcCollections) {
      const collectionName = collection.name;
      const srcCollection = db1Src.collection(collectionName);
      const destCollection = db1Dest.collection(collectionName);

      // Check if collection exists in destination
      const destCollections = await db1Dest.listCollections({ name: collectionName }).toArray();
      
      if (destCollections.length === 0) {
        // Create collection if it doesn't exist
        await db1Dest.createCollection(collectionName);
      }

      // Migrate in batches to avoid memory issues
      const batchSize = 1000;
      let skip = 0;
      let totalMigrated = 0;

      while (true) {
        const data = await srcCollection.find().skip(skip).limit(batchSize).toArray();
        if (data.length === 0) break;

        await destCollection.insertMany(data);
        totalMigrated += data.length;
        skip += batchSize;
        
        console.log(`Migrated ${totalMigrated} documents from ${collectionName} in db1.`);
      }
    }

    // Migrate data from db2 source to db2 destination
    console.log("Starting migration for DB2 (COK_EVENT_MNG)...");
    for (const collection of db2SrcCollections) {
      const collectionName = collection.name;
      const srcCollection = db2Src.collection(collectionName);
      const destCollection = db2Dest.collection(collectionName);

      // Check if collection exists in destination
      const destCollections = await db2Dest.listCollections({ name: collectionName }).toArray();
      
      if (destCollections.length === 0) {
        await db2Dest.createCollection(collectionName);
      }

      // Migrate in batches
      const batchSize = 1000;
      let skip = 0;
      let totalMigrated = 0;

      while (true) {
        const data = await srcCollection.find().skip(skip).limit(batchSize).toArray();
        if (data.length === 0) break;

        await destCollection.insertMany(data);
        totalMigrated += data.length;
        skip += batchSize;
        
        console.log(`Migrated ${totalMigrated} documents from ${collectionName} in db2.`);
      }
    }

    console.log("Data migration completed successfully.");
    
  } catch (error) {
    console.error("Error during data migration:", error);
  } finally {
    // Always close connections
    if (connections) {
      try {
        await connections.atlasConnection.close();
        await connections.prodConnection.close();
        console.log("Connections closed successfully.");
      } catch (closeError) {
        console.error("Error closing connections:", closeError);
      }
    }
  }
}

// Alternative approach: Connect and disconnect per database pair
async function migrateDataSequential() {
  const connections = [];
  
  try {
    // Migrate DB1 (cok)
    console.log("Starting migration for DB1 (cok)...");
    const atlasConn1 = await mongoose.createConnection(db_cok_campass_conne).asPromise();
    const prodConn1 = await mongoose.createConnection(db_cok_prod_conne).asPromise();
    connections.push(atlasConn1, prodConn1);

    const db1Src = atlasConn1.db;
    const db1Dest = prodConn1.db;

    const collections = await db1Src.listCollections().toArray();
    
    for (const collection of collections) {
      const collectionName = collection.name;
      const data = await db1Src.collection(collectionName).find().toArray();
      if (data.length > 0) {
        await db1Dest.collection(collectionName).insertMany(data);
        console.log(`Migrated ${data.length} documents from ${collectionName}`);
      }
    }

    // Close connections for DB1
    await atlasConn1.close();
    await prodConn1.close();
    connections.length = 0;

    // Migrate DB2 (COK_EVENT_MNG)
    console.log("Starting migration for DB2 (COK_EVENT_MNG)...");
    const atlasConn2 = await mongoose.createConnection(db_event_campass_conne).asPromise();
    const prodConn2 = await mongoose.createConnection(db_event_prod_conne).asPromise();
    connections.push(atlasConn2, prodConn2);

    const db2Src = atlasConn2.db;
    const db2Dest = prodConn2.db;

    const collections2 = await db2Src.listCollections().toArray();
    
    for (const collection of collections2) {
      const collectionName = collection.name;
      const data = await db2Src.collection(collectionName).find().toArray();
      if (data.length > 0) {
        await db2Dest.collection(collectionName).insertMany(data);
        console.log(`Migrated ${data.length} documents from ${collectionName}`);
      }
    }

    console.log("Data migration completed successfully.");
    
  } catch (error) {
    console.error("Error during data migration:", error);
  } finally {
    // Close any remaining connections
    for (const conn of connections) {
      try {
        await conn.close();
      } catch (e) {
        console.error("Error closing connection:", e);
      }
    }
  }
}

// Run migration
migrateData();
// Or use sequential approach
// migrateDataSequential();