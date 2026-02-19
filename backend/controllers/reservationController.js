const xlsx = require('xlsx');
const EmergencyCar = require('../models/emergency_car');

const bulkUploadReservations = async (req, res) => {
    try {
        // 1. Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload an Excel file.' });
        }

        // 2. Read the Excel file from memory
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0]; // Get the first sheet
        const sheet = workbook.Sheets[sheetName];

        // 3. Convert the Excel sheet to a JSON array
        const visitorsData = xlsx.utils.sheet_to_json(sheet);

        if (visitorsData.length === 0) {
            return res.status(400).json({ success: false, message: 'The uploaded Excel file is empty.' });
        }

        // 4. Map the Excel data to match your database schema
        const mappedVisitors = visitorsData.map(row => ({
            plate_number: row['Plate Number'] || row['plate number'] || '',
            driver_name: row['Name'] || row['name'] || '',
            driver_type: 'visitor',
            driver_identification: {
                id_type: row['ID Type'] || row['ID type'] || 'NID',
                number: String(row['ID Number'] || row['ID number'] || '')
            },
            telephone_number: String(row['Phone'] || row['phone'] || ''),
            slot_number: String(row['Slot Number'] || row['slot number'] || ''), 
            is_flagged: false
        }));

        // 5. Save to the database using the team's EmergencyCar model
        const newReservationBatch = new EmergencyCar({
            total_reserved_space: mappedVisitors.length,
            visitor_info: mappedVisitors,
            validity: {
                from: new Date(),
                to: new Date(new Date().setHours(23, 59, 59, 999)) // Valid until end of today
            },
            // Note: In a real app, this comes from req.user.id after Amos finishes Auth
            registered_by: 'Super_Admin_Bulk_Upload' 
        });

        await newReservationBatch.save();

        res.status(201).json({
            success: true,
            message: `Successfully registered ${mappedVisitors.length} visitors from Excel.`,
            data: newReservationBatch
        });

    } catch (error) {
        console.error('❌ Error in bulk upload:', error);
        res.status(500).json({ success: false, message: 'Server error during file upload.' });
    }
};

module.exports = {
    bulkUploadReservations
};