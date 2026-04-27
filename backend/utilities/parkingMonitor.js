const cron = require('node-cron');
const ParkingRecord = require('../models/parking_record');
const ServiceDelivery = require('../models/service_delivery');

// Define the limits (in milliseconds)
// Example: 2 hours for visitors, 12 hours for staff
const VISITOR_LIMIT_MS = 2 * 60 * 60 * 1000; 
const STAFF_LIMIT_MS = 12 * 60 * 60 * 1000;  

const POST_SERVICE_LIMIT_MS = 30 * 60 * 1000;

const startParkingMonitor = () => {
    // This cron expression '*/1 * * * *' means "Run every 1 minutes"
    cron.schedule('*/1 * * * *', async () => {
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
                if (record.driver_type === 'regular' && durationMs > VISITOR_LIMIT_MS) {
                    isOverstaying = true;
                } else if ((record.driver_type === 'staff' || record.driver_type === 'visitor') && durationMs > STAFF_LIMIT_MS) {
                    isOverstaying = true;
                }

                // ======================================================================
                // 4. 30-MINUTE POST-SERVICE CHECK FOR REGULARS
                // ======================================================================
                if (!isOverstaying && record.driver_type === 'regular') {
                    try {
                        // BULLETPROOF QUERY: Check root plate OR nested plate OR driver name
                        const visitor = await ServiceDelivery.findOne({
                            $or: [
                                { "vehicle_details.plate_number": record.plate_number },
                                { "vehicle_storage.vehicle_details.plate_number": record.plate_number },
                                { full_name: record.driver_name }
                            ],
                            is_still_inhouse: true
                        });

                        if (visitor && visitor.services_status && visitor.services_status.length > 0) {
                            const allServicesDone = visitor.services_status.every(
                                s => s.s_type?.toLowerCase() === 'completed' || s.s_type?.toLowerCase() === 'transfered'
                            );

                            if (allServicesDone && visitor.durations && visitor.durations.services_durations) {
                                const completionTimes = visitor.durations.services_durations
                                    .filter(d => d.ended_at)
                                    .map(d => new Date(d.ended_at).getTime());

                                if (completionTimes.length > 0) {
                                    const lastCompletionTime = Math.max(...completionTimes);
                                    const timeSinceServiceEndedMs = now.getTime() - lastCompletionTime;
                                    const minutesSinceEnd = Math.floor(timeSinceServiceEndedMs / 60000);

                                    if (timeSinceServiceEndedMs > POST_SERVICE_LIMIT_MS) {
                                        isOverstaying = true;
                                        overstayReason = `remained in parking ${minutesSinceEnd} minutes after service completed`;
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`[Monitor Error] Failed checking ServiceDelivery for plate ${record.plate_number}:`, err);
                    }
                }
                // ====================================================================================================
                // 4. Flag the vehicle and send the alert
                if (isOverstaying) {
                    record.is_flagged = true;
                    
                    // Calculate human-readable duration to save in DB (e.g., "2.5 hours")
                    const hours = (durationMs / (1000 * 60 * 60)).toFixed(1);
                    record.duration = `${hours} hours`;
                    
                    await record.save();

                    console.log(`ALERT: Vehicle ${record.plate_number} (${record.driver_type}) has overstayed!`);

                    // 5. Send real-time alert to Super Admin and Security (if Socket.io is passed in)
                    if (global.WebsocketIO) {
                        global.WebsocketIO.emit('parking_alert', {
                            type: 'OVERSTAY_WARNING',
                            message: `Vehicle ${record.plate_number} has overstayed its limit (${hours} hours).`,
                            record: record
                        });
                        console.log("📡 Real-time alert broadcasted to frontend!");
                    }else {
                        console.log("⚠️ WebSocket not initialized yet, skipping real-time alert.");
                }
              }
            }
        } catch (error) {
            console.error(' Error in Parking Monitor:', error);
        }
    });
};

module.exports = startParkingMonitor;