// Removes every car created by scripts/car_movement_test.js, and nothing else:
// parking records and flag history rows carrying TEST_MARKER, and the test
// visitor (kept, with a warning, if a real visit was ever recorded for it).
// Real parking data, slot counters and other visitors are not touched (all test
// cars are already checked out, so no slot is held by them).
//
// Run from the backend folder:
//   node scripts/car_movement_test_clear.js         (shows what will go, asks YES)
//   node scripts/car_movement_test_clear.js --yes   (deletes without asking)

// ---- Must match scripts/car_movement_test.js ----
const TEST_MARKER = 'CAR_MOVEMENT_TEST';
const TEST_VISITOR_PHONE = '+999000000001';

const readline = require('node:readline');
const mongoose = require('mongoose');
const connect_db = require('../db_connection/main');
const ParkingRecord = require('../models/parking_record');
const FlaggedVehicle = require('../models/flagged_vehicle');
const Visitor = require('../models/visitor');
const ServiceDelivery = require('../models/service_delivery');

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

(async () => {
    const yes = process.argv.slice(2).some((arg) => arg === '--yes' || arg === '--yes=true');

    const conn = await connect_db();
    if (!conn?.status) {
        console.error('Could not connect to the database:', conn?.message);
        process.exit(1);
    }

    const visitor = await Visitor.findOne({ telephone: TEST_VISITOR_PHONE }).select('_id full_name').lean();
    const [cars, active, flags, realVisits] = await Promise.all([
        ParkingRecord.countDocuments({ checked_in_by: TEST_MARKER }),
        ParkingRecord.countDocuments({ checked_in_by: TEST_MARKER, status: 'active' }),
        FlaggedVehicle.countDocuments({ checked_in_by: TEST_MARKER }),
        visitor ? ServiceDelivery.countDocuments({ visitor: visitor._id }) : 0,
    ]);
    const otherCars = visitor ? await ParkingRecord.countDocuments({ visitor: visitor._id, checked_in_by: { $ne: TEST_MARKER } }) : 0;
    const keepVisitor = realVisits > 0 || otherCars > 0;

    console.log('Car movement test data to remove');
    console.log(`  Database:     ${mongoose.connection.host} / ${mongoose.connection.name}`);
    console.log(`  Test cars:    ${cars}${active ? ` (${active} still marked active)` : ''}`);
    console.log(`  Flag history: ${flags}`);
    console.log(`  Test visitor: ${visitor ? `${visitor.full_name} (${TEST_VISITOR_PHONE})` : 'none'}${visitor && keepVisitor ? ' - kept: it has real visits or cars' : ''}`);

    if (!cars && !flags && !(visitor && !keepVisitor)) {
        console.log('Nothing to remove.');
        process.exit(0);
    }
    if (!yes) {
        const answer = await ask('Type YES to delete this test data: ');
        if (answer.trim() !== 'YES') {
            console.log('Cancelled, nothing deleted.');
            process.exit(0);
        }
    }

    const removedCars = await ParkingRecord.deleteMany({ checked_in_by: TEST_MARKER });
    const removedFlags = await FlaggedVehicle.deleteMany({ checked_in_by: TEST_MARKER });
    let removedVisitor = 0;
    if (visitor && !keepVisitor) removedVisitor = (await Visitor.deleteOne({ _id: visitor._id })).deletedCount || 0;

    console.log(`Done: removed ${removedCars.deletedCount || 0} car(s), ${removedFlags.deletedCount || 0} flag(s), ${removedVisitor} test visitor.`);
    if (active) console.log('Note: some test cars were active; check the parking slot counters on the admin page.');
    process.exit(0);
})().catch((err) => {
    console.error('Removing test data failed:', err);
    process.exit(1);
});
