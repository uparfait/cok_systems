const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

async function dropIndexes() {
  try {
    await mongoose.connect(process.env.conne_string);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('notificationsubscriptions');

    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    const uniqueIndexes = indexes.filter(idx => idx.unique);
    for (const idx of uniqueIndexes) {
      const indexName = idx.name;
      console.log(`Dropping unique index: ${indexName}`);
      await collection.dropIndex(indexName);
      console.log(`Dropped index: ${indexName}`);
    }

    console.log('All unique indexes dropped successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error dropping indexes:', error);
    process.exit(1);
  }
}

dropIndexes();
