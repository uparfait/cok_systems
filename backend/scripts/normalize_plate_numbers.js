// One-time cleanup: normalize every stored plate number to UPPERCASE with no spaces
// so reservation lookups at verify/check-in always match.
// Run from the backend folder:  node scripts/normalize_plate_numbers.js
const connect_db = require('../db_connection/main');
const StaffCar = require('../models/staff_car');
const EmergencyCar = require('../models/emergency_car');
const EmergencyCarHistory = require('../models/emergency_car_history');
const ParkingRecord = require('../models/parking_record');

const normalizePlate = (p) => String(p || '').toUpperCase().replace(/\s+/g, '');

(async () => {
    const conn = await connect_db();
    if (!conn?.status) {
        console.error('Could not connect to the database:', conn?.message);
        process.exit(1);
    }

    let staffFixed = 0;
    for (const car of await StaffCar.find({})) {
        const n = normalizePlate(car.plate_number);
        if (n && n !== car.plate_number) {
            car.plate_number = n;
            await car.save();
            staffFixed++;
        }
    }
    console.log(`StaffCar: normalized ${staffFixed} plate(s)`);

    for (const Model of [EmergencyCar, EmergencyCarHistory]) {
        let fixed = 0;
        for (const doc of await Model.find({})) {
            let changed = false;
            (doc.visitor_info || []).forEach(v => {
                const n = normalizePlate(v.plate_number);
                if (n && n !== v.plate_number) {
                    v.plate_number = n;
                    changed = true;
                }
            });
            if (changed) {
                doc.markModified('visitor_info');
                await doc.save();
                fixed++;
            }
        }
        console.log(`${Model.modelName}: normalized plates in ${fixed} document(s)`);
    }

    let recordsFixed = 0;
    for (const rec of await ParkingRecord.find({})) {
        const n = normalizePlate(rec.plate_number);
        if (n && n !== rec.plate_number) {
            rec.plate_number = n;
            await rec.save();
            recordsFixed++;
        }
    }
    console.log(`ParkingRecord: normalized ${recordsFixed} plate(s)`);

    console.log('Done.');
    process.exit(0);
})().catch(err => {
    console.error('Normalization failed:', err);
    process.exit(1);
});
