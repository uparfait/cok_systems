const cron = require('node-cron');
const ParkingRecord = require('../models/parking_record');

// Define the limits (in milliseconds)
// Example: 2 hours for visitors, 12 hours for staff
const VISITOR_LIMIT_MS = 2 * 60 * 60 * 1000; 
const STAFF_LIMIT_MS = 12 * 60 * 60 * 1000;  

const startParkingMonitor = (io) => {
    // This cron expression '*/5 * * * *' means "Run every 5 minutes"
    cron.schedule('*/5 * * * *', async () => {
        console.log('[Cron] Running Parking Monitor Check...');

        try {
            const now = new Date();
            
            // 1. Find all active parking sessions that are not yet flagged
            const activeRecords = await ParkingRecord.find({
                status: 'active',
                is_flagged: false
            });

            // 2. Loop through each car currently parked
            for (let record of activeRecords) {
                // Ensure check_in exists to prevent errors
                if (!record.check_in) continue;

                const checkInTime = new Date(record.check_in);
                const durationMs = now - checkInTime;

                let isOverstaying = false;

                // 3. Apply the specific rules for Staff vs Visitors
                if (record.driver_type === 'visitor' && durationMs > VISITOR_LIMIT_MS) {
                    isOverstaying = true;
                } else if ((record.driver_type === 'staff' || record.driver_type === 'regular') && durationMs > STAFF_LIMIT_MS) {
                    isOverstaying = true;
                }

                // 4. Flag the vehicle and send the alert
                if (isOverstaying) {
                    record.is_flagged = true;
                    
                    // Calculate human-readable duration to save in DB (e.g., "2.5 hours")
                    const hours = (durationMs / (1000 * 60 * 60)).toFixed(1);
                    record.duration = `${hours} hours`;
                    
                    await record.save();

                    console.log(`ALERT: Vehicle ${record.plate_number} (${record.driver_type}) has overstayed!`);

                    // 5. Send real-time alert to Super Admin and Security (if Socket.io is passed in)
                    if (io) {
                        io.emit('parking_alert', {
                            message: `Vehicle ${record.plate_number} has overstayed its limit (${hours} hours).`,
                            record: record
                        });
                    }
                }
            }
        } catch (error) {
            console.error(' Error in Parking Monitor:', error);
        }
    });
};

module.exports = startParkingMonitor;