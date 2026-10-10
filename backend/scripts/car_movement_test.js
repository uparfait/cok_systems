// Test data for the smart parking chart: car movement between START and END.
//
// Every hour gets a random number of cars (MIN_CARS_PER_HOUR..MAX_CARS_PER_HOUR).
// Each car checks in at a random minute of that hour, stays a random time
// (MIN_STAY_MINUTES..MAX_STAY_MINUTES, never ending after now) and is saved as
// already checked out. Flagging follows the gate rules: a stay longer than the
// allowed time gets flagged_at / flag_reason on its parking record and a row in
// the flag history (FlaggedVehicle), exactly like a real overstay checkout.
//
// Everything created carries TEST_MARKER (checked_in_by) and belongs to one test
// visitor, so scripts/car_movement_test_clear.js removes it and nothing else.
//
// Run from the backend folder:
//   node scripts/car_movement_test.js
//   node scripts/car_movement_test.js --start=2026-09-01T00:00 --end=2026-10-02T18:00 --min=0 --max=6
//   node scripts/car_movement_test.js --min-stay=10 --max-stay=43200 --yes
// Flags: --start --end (Kigali time, YYYY-MM-DD or YYYY-MM-DDTHH:MM), --min --max (cars per hour),
//        --min-stay --max-stay (minutes), --skew, --yes (write without asking).

// ---- Settings (the command-line flags above override them) ----
const START = '2026-09-01T00:00';          // Kigali time: first hour that gets cars
const END = '2026-10-02T23:59';            // Kigali time: no check-in after this (and never after now)
const MIN_CARS_PER_HOUR = 0;
const MAX_CARS_PER_HOUR = 6;
const MIN_STAY_MINUTES = 10;               // shortest stay
const MAX_STAY_MINUTES = 30 * 24 * 60;     // longest stay: one month
const STAY_SKEW = 4;                       // 1 = every stay length equally likely; higher = more short stays
const DRIVER_TYPES = { regular: 80, visitor: 15, staff: 5 }; // share of the cars per type, in percent

// ---- Marker shared with car_movement_test_clear.js ----
const TEST_MARKER = 'CAR_MOVEMENT_TEST';
const TEST_PLATE_PREFIX = 'TST';
const TEST_VISITOR = { full_name: 'Car Movement Test', telephone: '+999000000001' };

const readline = require('node:readline');
const mongoose = require('mongoose');
const connect_db = require('../db_connection/main');
const ParkingRecord = require('../models/parking_record');
const FlaggedVehicle = require('../models/flagged_vehicle');
const Visitor = require('../models/visitor');
const { ALLOWED_MINUTES } = require('../utilities/visitors/parking.js');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const KIGALI_OFFSET = 2 * HOUR; // Rwanda is UTC+2 all year
const BATCH = 1000;

function readFlags(argv) {
    const flags = {};
    for (const arg of argv) {
        const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
        if (match) flags[match[1]] = match[2] === undefined ? true : match[2];
    }
    return flags;
}

/** YYYY-MM-DD or YYYY-MM-DDTHH:MM in Kigali time, as an instant, or null. */
function kigaliTime(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(value || '').trim());
    if (!match) return null;
    const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0)) - KIGALI_OFFSET;
    return Number.isNaN(ms) ? null : ms;
}

const showKigali = (ms) => new Date(ms + KIGALI_OFFSET).toISOString().slice(0, 16).replace('T', ' ');
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function pickDriverType() {
    const entries = Object.entries(DRIVER_TYPES).filter(([, share]) => share > 0);
    const total = entries.reduce((sum, [, share]) => sum + share, 0);
    let roll = Math.random() * total;
    for (const [type, share] of entries) {
        roll -= share;
        if (roll < 0) return type;
    }
    return entries[entries.length - 1][0];
}

/** Stay length in minutes; a higher skew makes short stays more common. */
const randomStay = (min, max, skew) => min + Math.floor(Math.pow(Math.random(), skew) * (max - min + 1));

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

function settings(flags) {
    const num = (key, fallback) => (flags[key] === undefined ? fallback : Number(flags[key]));
    const s = {
        start: kigaliTime(flags.start || START),
        end: kigaliTime(flags.end || END),
        minCars: num('min', MIN_CARS_PER_HOUR),
        maxCars: num('max', MAX_CARS_PER_HOUR),
        minStay: num('min-stay', MIN_STAY_MINUTES),
        maxStay: num('max-stay', MAX_STAY_MINUTES),
        skew: num('skew', STAY_SKEW),
        yes: flags.yes === true || flags.yes === 'true',
    };
    const problems = [];
    if (s.start === null) problems.push('start must be YYYY-MM-DD or YYYY-MM-DDTHH:MM');
    if (s.end === null) problems.push('end must be YYYY-MM-DD or YYYY-MM-DDTHH:MM');
    if (s.start !== null && s.end !== null && s.end <= s.start) problems.push('end must be after start');
    if (![s.minCars, s.maxCars].every(Number.isInteger) || s.minCars < 0 || s.maxCars < s.minCars) problems.push('cars per hour: 0 <= min <= max, whole numbers');
    if (![s.minStay, s.maxStay].every(Number.isInteger) || s.minStay < 1 || s.maxStay < s.minStay) problems.push('stay minutes: 1 <= min-stay <= max-stay, whole numbers');
    if (!(s.skew >= 1)) problems.push('skew must be 1 or more');
    return { s, problems };
}

/** Build the parking records and flag history rows in memory. */
function generate(s, now, firstNumber) {
    const records = [];
    const flags = [];
    let skipped = 0;
    let number = firstNumber;
    const end = Math.min(s.end, now);
    for (let hour = s.start - (s.start % HOUR); hour < end; hour += HOUR) {
        const cars = randomInt(s.minCars, s.maxCars);
        for (let k = 0; k < cars; k += 1) {
            const checkIn = hour + randomInt(0, 59) * MINUTE + randomInt(0, 59) * 1000;
            if (checkIn < s.start || checkIn >= end) continue;
            // Every car has already left: its stay must end before now
            const roomMinutes = Math.floor((now - checkIn) / MINUTE);
            const maxStay = Math.min(s.maxStay, roomMinutes);
            if (maxStay < s.minStay) { skipped += 1; continue; }
            const stay = randomStay(s.minStay, maxStay, s.skew);
            const checkOut = checkIn + stay * MINUTE;
            const driverType = pickDriverType();
            const allowed = ALLOWED_MINUTES[driverType] || ALLOWED_MINUTES.regular;
            number += 1;
            const record = {
                _id: new mongoose.Types.ObjectId(),
                plate_number: `${TEST_PLATE_PREFIX}${String(number).padStart(5, '0')}`,
                driver_type: driverType,
                slot_number: 'Not Specified',
                status: 'completed',
                check_in: new Date(checkIn),
                check_out: new Date(checkOut),
                duration: `${stay} mins`,
                checked_in_by: TEST_MARKER,
                is_flagged: false,
                flagged_at: null,
                flag_reason: null,
                badge_number: null,
            };
            if (stay > allowed) {
                const flaggedAt = new Date(checkIn + allowed * MINUTE);
                record.flagged_at = flaggedAt;
                record.flag_reason = `Exceeded allowed ${allowed} minutes by ${stay - allowed} minutes`;
                flags.push({
                    plate_number: record.plate_number,
                    driver_type: driverType,
                    parking_record: record._id,
                    slot_number: record.slot_number,
                    checked_in_by: TEST_MARKER,
                    check_in_time: record.check_in,
                    flagged_at: flaggedAt,
                    check_out_time: record.check_out,
                    allowed_duration_minutes: allowed,
                    total_duration_minutes: stay,
                    flagged_duration_minutes: stay - allowed,
                });
            }
            records.push(record);
        }
    }
    return { records, flags, skipped };
}

async function insertInBatches(Model, docs) {
    for (let i = 0; i < docs.length; i += BATCH) {
        await Model.insertMany(docs.slice(i, i + BATCH), { ordered: false });
        process.stdout.write(`\r  ${Model.modelName}: ${Math.min(i + BATCH, docs.length)} / ${docs.length}`);
    }
    if (docs.length) process.stdout.write('\n');
}

(async () => {
    const { s, problems } = settings(readFlags(process.argv.slice(2)));
    if (problems.length) {
        console.error('Invalid settings:\n  - ' + problems.join('\n  - '));
        process.exit(1);
    }

    const conn = await connect_db();
    if (!conn?.status) {
        console.error('Could not connect to the database:', conn?.message);
        process.exit(1);
    }

    const now = Date.now();
    const existing = await ParkingRecord.countDocuments({ checked_in_by: TEST_MARKER });
    const { records, flags, skipped } = generate(s, now, existing);
    const byType = records.reduce((acc, r) => ({ ...acc, [r.driver_type]: (acc[r.driver_type] || 0) + 1 }), {});

    console.log('Car movement test data');
    console.log(`  Database:        ${mongoose.connection.host} / ${mongoose.connection.name}`);
    console.log(`  Period (Kigali): ${showKigali(s.start)} -> ${showKigali(Math.min(s.end, now))}${s.end > now ? ' (end moved to now)' : ''}`);
    console.log(`  Cars per hour:   ${s.minCars} - ${s.maxCars}`);
    console.log(`  Stay (minutes):  ${s.minStay} - ${s.maxStay} (skew ${s.skew})`);
    console.log(`  Cars to create:  ${records.length} (${Object.entries(byType).map(([t, n]) => `${t} ${n}`).join(', ') || 'none'}), all checked out`);
    console.log(`  Flagged:         ${flags.length} (flag history rows)`);
    if (skipped) console.log(`  Skipped:         ${skipped} car(s) that could not have left before now`);
    if (existing) console.log(`  Already present: ${existing} test car(s) from earlier runs (kept)`);

    if (!records.length) {
        console.log('Nothing to create.');
        process.exit(0);
    }
    if (!s.yes) {
        const answer = await ask('Type YES to write this test data: ');
        if (answer.trim() !== 'YES') {
            console.log('Cancelled, nothing written.');
            process.exit(0);
        }
    }

    let visitor = await Visitor.findOne({ telephone: TEST_VISITOR.telephone });
    if (!visitor) {
        visitor = await Visitor.create({ ...TEST_VISITOR, Is_In_House: false, N_visits: 0, created_by: { user_id: '', name: TEST_MARKER }, updated_by: { user_id: '', name: TEST_MARKER } });
    }
    records.forEach((r) => { r.visitor = visitor._id; });
    flags.forEach((f) => { f.visitor = visitor._id; });

    await insertInBatches(ParkingRecord, records);
    await insertInBatches(FlaggedVehicle, flags);
    await Visitor.updateOne({ _id: visitor._id }, { $inc: { N_visits: records.length }, $set: { Is_In_House: false } });

    console.log(`Done: ${records.length} car(s), ${flags.length} flag(s). Remove them with: node scripts/car_movement_test_clear.js`);
    process.exit(0);
})().catch((err) => {
    console.error('Generating test data failed:', err);
    process.exit(1);
});
