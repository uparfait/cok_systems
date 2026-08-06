const mongoose = require('mongoose');

const BATCH_SIZE = 500;

async function getDocumentsInRanges(collectionName, dateField, buckets) {
  if (!buckets || buckets.length === 0) return {};

  const db = mongoose.connection.db;
  const collection = db.collection(collectionName);
  if (!collection) {
    console.error(`[Evolution] Collection not found: ${collectionName}`);
    return {};
  }

  const results = {};
  const bucketRanges = buckets.map(b => ({ ...b, count: 0 }));

  try {
    const minDate = buckets[0].start;
    const maxDate = buckets[buckets.length - 1].end;
    
    const cursor = collection.find({
      [dateField]: { $gte: minDate, $lte: maxDate },
    }).project({ [dateField]: 1 }).batchSize(BATCH_SIZE);

    let processed = 0;
    let errors = 0;
    while (await cursor.hasNext()) {
      try {
        const doc = await cursor.next();
        if (!doc || !doc[dateField]) continue;

        const docDate = new Date(doc[dateField]);
        if (isNaN(docDate.getTime())) continue;

        for (let i = 0; i < bucketRanges.length; i++) {
          const bucket = bucketRanges[i];
          if (docDate >= bucket.start && docDate <= bucket.end) {
            bucket.count++;
            break;
          }
        }
        processed++;
      } catch (docError) {
        errors++;
        if (errors > 100) {
          console.error(`[Evolution] Too many errors on ${collectionName}, aborting.`);
          break;
        }
      }
    }

    for (const bucket of bucketRanges) {
      results[bucket.label] = {
        name: bucket.label,
        size: bucket.count,
        formattedSize: `${bucket.count} records`,
      };
    }

    console.log(`[Evolution] ${collectionName}: scanned=${processed}, buckets=${bucketRanges.length}, errors=${errors}`);
  } catch (err) {
    console.error(`[Evolution] cursor error on ${collectionName}:`, err.message);
  }

  return results;
}

module.exports = { getDocumentsInRanges };
