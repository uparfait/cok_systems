const cron = require('node-cron');
const Request = require('../models/request');

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const countBusinessDaysSince = (startDate, endDate) => {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

const startOverdueMonitor = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running Overdue Request Monitor...');
    try {
      const now = new Date();
      const pendingRequests = await Request.find({
        status: { $in: ['Pending', 'Inprogress'] },
        redaction_date: { $exists: true, $ne: null }
      });

      let updatedCount = 0;
      for (const req of pendingRequests) {
        const redactionDate = new Date(req.redaction_date);
        redactionDate.setHours(0, 0, 0, 0);
        const businessDays = countBusinessDaysSince(redactionDate, now);

        if (businessDays > 7) {
          req.status = 'Overdue';
          req.updated_at = new Date();
          await req.save();
          updatedCount++;
          console.log(`[Overdue] Request ${req._id} marked as Overdue (${businessDays} business days since redaction)`);
        }
      }

      console.log(`[Cron] Overdue monitor completed. ${updatedCount} requests marked as Overdue.`);
    } catch (error) {
      console.error('Error in Overdue Monitor:', error);
    }
  });

  console.log('Overdue Request Monitor started successfully.');
};

module.exports = startOverdueMonitor;
