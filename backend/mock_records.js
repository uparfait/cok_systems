const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const ParkingRecord = require('./models/parking_record.js');
const ServiceDelivery = require('./models/service_delivery.js');

// Database connection
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const conne_user = process.env.conne_user || 'cok_systems';
const conne_password = process.env.conne_password || 'kigalicity';
const conne_app_name = process.env.conne_app_name || 'cok_systems';
const conne_string = process.env.conne_string || `mongodb+srv://${conne_user}:${conne_password}@coksystems.rldhlb3.mongodb.net/cok?appName=coksystems`;

// Configuration for record generation
const CONFIG = {
    min_records_per_hour: 100,
    max_records_per_hour: 300,
    base_date: new Date(), // Today's date
    checked_in_by: 'Mock System'
};

// Generate random plate number
function generatePlateNumber() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = letters[Math.floor(Math.random() * letters.length)] +
                   letters[Math.floor(Math.random() * letters.length)];
    const numbers = Math.floor(Math.random() * 9000) + 1000;
    return `${prefix}${numbers}`;
}

// Generate random phone number
function generatePhoneNumber() {
    return `0${Math.floor(Math.random() * 900000000) + 100000000}`;
}

// Generate random gender
function generateGender() {
    return Math.random() > 0.5 ? 'Male' : 'Female';
}

// Generate random ID type
function generateIdType() {
    const types = ['National ID', 'Passport', 'Driver License'];
    return types[Math.floor(Math.random() * types.length)];
}

// Generate random ID number
function generateIdNumber() {
    return faker.string.alphanumeric(10).toUpperCase();
}

// Generate random badge number
function generateBadgeNumber() {
    return `B${Math.floor(Math.random() * 90000) + 10000}`;
}

// Generate random slot number
function generateSlotNumber() {
    const section = String.fromCharCode(65 + Math.floor(Math.random() * 5)); // A-E
    const number = Math.floor(Math.random() * 50) + 1;
    return `${section}${number}`;
}

// Generate a single mock record
function generateMockRecord(checkInTime) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    const plateNumber = generatePlateNumber();
    const gender = generateGender();
    const phone = generatePhoneNumber();
    const email = faker.internet.email({ firstName, lastName });
    const idType = generateIdType();
    const idNumber = generateIdNumber();
    const badgeNumber = generateBadgeNumber();
    const slotNumber = generateSlotNumber();

    return {
        fullName,
        plateNumber,
        gender,
        phone,
        email,
        idType,
        idNumber,
        badgeNumber,
        slotNumber,
        checkInTime
    };
}

// Create ParkingRecord
async function createParkingRecord(record) {
    const parkingRecord = new ParkingRecord({
        plate_number: record.plateNumber,
        driver_identification: {
            id_type: record.idType,
            number: record.idNumber
        },
        driver_name: record.fullName,
        driver_telephone: record.phone,
        driver_gender: record.gender,
        driver_type: 'Regular',
        driver_email: record.email,
        slot_number: record.slotNumber,
        status: 'active',
        check_in: record.checkInTime,
        checked_in_by: CONFIG.checked_in_by,
        badge_number: record.badgeNumber
    });

    return await parkingRecord.save();
}

// Create ServiceDelivery record
async function createServiceDelivery(record) {
    const serviceDelivery = new ServiceDelivery({
        full_name: record.fullName,
        telephone: record.phone,
        gender: record.gender,
        email: record.email,
        driver_identification: {
            id_type: record.idType,
            number: record.idNumber
        },
        identification: {
            id_type: record.idType,
            number: record.idNumber
        },
        vehicle_storage: {
            has_vehicle: true,
            vehicle_details: {
                plate_number: record.plateNumber,
                slot_number: record.slotNumber
            }
        },
        badge_number: record.badgeNumber,
        is_still_inhouse: true,
        entry_date: record.checkInTime,
        registered_by: CONFIG.checked_in_by
    });

    return await serviceDelivery.save();
}

// Generate records for a specific hour
async function generateRecordsForHour(hour) {
    const numRecords = Math.floor(
        Math.random() * (CONFIG.max_records_per_hour - CONFIG.min_records_per_hour + 1) +
        CONFIG.min_records_per_hour
    );

    console.log(`\nGenerating ${numRecords} records for hour ${hour.toString().padStart(2, '0')}:00`);

    const records = [];
    const baseDate = new Date(CONFIG.base_date);
    baseDate.setHours(hour, 0, 0, 0);

    for (let i = 0; i < numRecords; i++) {
        // Add random minutes within the hour
        const checkInTime = new Date(baseDate);
        checkInTime.setMinutes(Math.floor(Math.random() * 60));
        checkInTime.setSeconds(Math.floor(Math.random() * 60));

        const record = generateMockRecord(checkInTime);
        records.push(record);
    }

    // Insert records in batches for better performance
    const batchSize = 50;
    let parkingSuccess = 0;
    let serviceSuccess = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        const parkingPromises = batch.map(record =>
            createParkingRecord(record)
                .then(() => { parkingSuccess++; })
                .catch(err => {
                    errors++;
                    console.error(`Error creating parking record: ${err.message}`);
                })
        );

        const servicePromises = batch.map(record =>
            createServiceDelivery(record)
                .then(() => { serviceSuccess++; })
                .catch(err => {
                    errors++;
                    console.error(`Error creating service delivery record: ${err.message}`);
                })
        );

        await Promise.all([...parkingPromises, ...servicePromises]);

        // Progress indicator
        const progress = Math.min(i + batchSize, records.length);
        process.stdout.write(`\rProgress: ${progress}/${records.length} records processed`);
    }

    console.log(`\nHour ${hour.toString().padStart(2, '0')}:00 completed:`);
    console.log(`  - Parking records created: ${parkingSuccess}`);
    console.log(`  - Service delivery records created: ${serviceSuccess}`);
    console.log(`  - Errors: ${errors}`);

    return { parkingSuccess, serviceSuccess, errors };
}

// Main function
async function main() {
    console.log('='.repeat(60));
    console.log('Mock Records Generator');
    console.log('='.repeat(60));
    console.log(`Base date: ${CONFIG.base_date.toDateString()}`);
    console.log(`Records per hour: ${CONFIG.min_records_per_hour} - ${CONFIG.max_records_per_hour}`);
    console.log('='.repeat(60));

    try {
        // Connect to database
        console.log('\nConnecting to database...');
        const conn = await mongoose.connect(conne_string);
        console.log(`Connected to database: ${conn.connection.name}`);

        // Track overall statistics
        let totalParkingRecords = 0;
        let totalServiceRecords = 0;
        let totalErrors = 0;
        const startTime = Date.now();

        // Generate records for each hour from 00:00 to 23:00
        for (let hour = 0; hour < 24; hour++) {
            const hourStart = Date.now();
            const result = await generateRecordsForHour(hour);
            const hourDuration = ((Date.now() - hourStart) / 1000).toFixed(2);

            totalParkingRecords += result.parkingSuccess;
            totalServiceRecords += result.serviceSuccess;
            totalErrors += result.errors;

            console.log(`  Time taken: ${hourDuration} seconds`);
        }

        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('GENERATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`Total parking records created: ${totalParkingRecords}`);
        console.log(`Total service delivery records created: ${totalServiceRecords}`);
        console.log(`Total errors: ${totalErrors}`);
        console.log(`Total time: ${totalDuration} seconds`);
        console.log('='.repeat(60));

        // Close database connection
        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
        console.log('Mock records generation completed successfully!');

    } catch (error) {
        console.error('\nFatal error:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { main, generateRecordsForHour };
