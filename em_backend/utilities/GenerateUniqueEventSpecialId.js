const { v4: uuidv4 } = require('uuid');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');

class GenerateUniqueEventSpecialId {
  static async execute() {
    let isUnique = false;
    let eventSpecialId;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      eventSpecialId = uuidv4();
      
      const collections = [LiveEvent, UpcomingEvent, RecurringEvent, PastEvent];
      const results = await Promise.all(
        collections.map(model => 
          model.findOne({ eventSpecialId }).select('_id').lean()
        )
      );

      isUnique = results.every(result => result === null);
      attempts++;

      if (attempts >= maxAttempts && !isUnique) {
        throw new Error('Failed to generate unique event ID after maximum attempts');
      }
    }

    return eventSpecialId;
  }
}

module.exports = GenerateUniqueEventSpecialId;