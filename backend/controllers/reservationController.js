const xlsx = require('xlsx');
const mongoose = require('mongoose');
const EmergencyCar = require('../models/emergency_car');
const ParkingSlot = require('../models/parking_slots');

const { normalizePlate, parseTemplateDate } = require('../utilities/reservationUtils');

/**
 * OPTION A: Single Visitor Reservation
 * Used when the Admin fills out a web form for a single guest.
 */
const registerSingleReservation = async (req, res) => {
    try {
        const { plate_number, driver_name, id_type, id_number, telephone_number, slot_number } = req.body;

        if (!plate_number || !driver_name) {
            return res.status(400).json({ success: false, message: 'Plate number and driver name are required.' });
        }

        // 1. Create the single visitor object
        const singleVisitor = {
            plate_number: normalizePlate(plate_number),
            driver_name,
            driver_type: 'visitor',
            driver_identification: {
                id_type: id_type || 'NID',
                number: id_number || ''
            },
            telephone_number: telephone_number || '',
            slot_number: slot_number || '',
            is_flagged: false
        };

        // 2. Save it inside the EmergencyCar batch format (with space = 1).
        // No expiry date: the reservation stays valid until the vehicle checks in or it is cancelled.
        const newReservation = new EmergencyCar({
            total_reserved_space: 1,
            visitor_info: [singleVisitor],
            validity: {
                from: new Date(),
                to: null
            },
            registered_by: 'Super_Admin'
        });

await newReservation.save();

         // Increment visitor reservation count (do NOT affect RegularAvailableSlots)
         const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
         if (parkingSlot) {
             parkingSlot.visitorReservationCount = (parkingSlot.visitorReservationCount || 0) + 1;
             await parkingSlot.save();
         }

         // Live-refresh dashboards showing reserved counts / the parking status map
         global.WebsocketIO?.emit('parking_update', { type: 'info', message: 'New visitor reservation registered' });

         res.status(201).json({
            success: true,
            message: `Successfully registered visitor reservation for ${driver_name}.`,
            data: newReservation
        });

    } catch (error) {
        console.error(' Error in single reservation:', error);
        res.status(500).json({ success: false, message: 'Server error during single reservation.' });
    }
};

/**
 * OPTION B: Bulk Excel Upload for Visitors
 * Used when Admin uploads an Excel file with multiple guest reservations.
 */
const bulkUploadReservations = async (req, res) => {
    try {

        if(req.UploadError) {

            return res.status(400).json({ success: false, message: req.UploadError.message });
        }

        // 1. OPTIONAL HANDLING: Accept 1 file or Many files gracefully
        let uploadedFiles = [];
        
        // If Multer processed multiple files (or one file via upload.any / upload.array)
        if (req.files && req.files.length > 0) {
            uploadedFiles = req.files.filter(f => f.fieldname === 'file' || f.fieldname === 'files');
        } 
        // Fallback: If Multer processed exactly one file via upload.single
        else if (req.file) {
            uploadedFiles = [req.file];
        }

        // If the user clicked upload without attaching anything
        if (uploadedFiles.length === 0) {
            return res.status(400).json({ success: false, message: 'No file(s) provided. Please upload at least one Excel file.' });
        }

        let allVisitorsData = [];

        // 2. Loop through the files in the exact order they were attached
        for (let file of uploadedFiles) {
            const workbook = xlsx.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0]; 
            const sheet = workbook.Sheets[sheetName];
            
            // Convert this specific file into JSON rows
            const fileData = xlsx.utils.sheet_to_json(sheet);
            
            // 3. MERGE: Concatenate this file's data to the bottom of the master list.
            // This guarantees File 2's rows perfectly follow File 1's rows.
            allVisitorsData = allVisitorsData.concat(fileData);
        }

        if (allVisitorsData.length === 0) {
            return res.status(400).json({ success: false, message: 'The uploaded Excel file(s) are empty.' });
        }

        // 4. Map the newly combined, single list (plates normalized; rows without a plate are skipped)
        const mappedVisitors = allVisitorsData.map(row => ({
            plate_number: normalizePlate(row['Plate Number'] || row['plate number'] || ''),
            driver_name: row['Name'] || row['name'] || '',
            driver_type: 'visitor',
            driver_identification: {
                id_type: row['ID Type'] || row['ID type'] || 'NID',
                number: String(row['ID Number'] || row['id_number'] || '')
            },
            telephone_number: String(row['Phone'] || row['phone'] || ''),
            valid_from: parseTemplateDate(row['Start Date'] || row['start date'] || row['Start'] || row['start'], false),
            valid_until: parseTemplateDate(row['End Date'] || row['end date'] || row['End'] || row['end'] || row['Date'] || row['date'] || row['Valid Until'] || row['valid_until']),
            is_flagged: false
        })).filter(v => v.plate_number);

        if (mappedVisitors.length === 0) {
            return res.status(400).json({ success: false, message: 'No rows with a plate number found in the uploaded file(s).' });
        }

        // Rows whose End Date already passed (they would only be auto-cancelled
        // immediately) or whose Start Date is after their End Date are rejected up
        // front — the response says how many were skipped.
        const uploadTime = new Date();
        const isBadRow = (v) => (v.valid_until && v.valid_until < uploadTime)
            || (v.valid_from && v.valid_until && v.valid_from > v.valid_until);
        const pastRows = mappedVisitors.filter(isBadRow);
        const validVisitors = mappedVisitors.filter(v => !isBadRow(v));
        if (validVisitors.length === 0) {
            return res.status(400).json({
                success: false,
                message: `All ${pastRows.length} row(s) have an End Date that already passed or a Start Date after the End Date (format is day/month/year). Nothing was registered.`
            });
        }

        // 5. Save everything as ONE single database document. The batch is named after
        // the uploaded file so the admin can find/cancel/reschedule the whole upload.
        const newReservationBatch = new EmergencyCar({
            total_reserved_space: validVisitors.length,
            visitor_info: validVisitors,
            validity: {
                from: new Date(),
                to: null
            },
            registered_by: 'Super_Admin_Bulk_Upload',
            batch_name: uploadedFiles[0]?.originalname || null
        });

        // --- 2. THE TRANSACTION BUBBLE (Database Actions) ---
        
        // A. Start the session and the safety bubble
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // B. Do the database work, explicitly passing the { session }
            await newReservationBatch.save({ session });

// Increment visitor reservation count
             const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' }).session(session);
             if (parkingSlot) {
                 parkingSlot.visitorReservationCount = (parkingSlot.visitorReservationCount || 0) + validVisitors.length;
                 await parkingSlot.save({ session });
             }

            // C. If nothing crashed, make it permanent!
            await session.commitTransaction();
            
            // End the session after committing
            session.endSession();

        // Live-refresh dashboards showing reserved counts / the parking status map
        global.WebsocketIO?.emit('parking_update', { type: 'info', message: `${validVisitors.length} visitor reservations uploaded` });

        res.status(201).json({
            success: true,
            message: `Successfully registered ${validVisitors.length} visitor reservation(s).`
                + (pastRows.length ? ` ${pastRows.length} row(s) skipped — End Date already passed or Start Date after End Date (format is day/month/year).` : ''),
            data: newReservationBatch
        });

        } catch (dbError) {
            // D. If ANYTHING failed, hit the UNDO button!
            await session.abortTransaction();
            session.endSession();
            
            console.error(' Database Transaction Failed & Rolled Back:', dbError);
            return res.status(500).json({ success: false, message: 'Database error during save. All changes were rolled back.' });
        }

    } catch (error) {
        console.error('Error in bulk upload:', error);
        res.status(500).json({ success: false, message: 'Server error during file upload.' });
    }
};

module.exports = {
    bulkUploadReservations,
    registerSingleReservation
};