const xlsx = require('xlsx');
const EmergencyCar = require('../models/emergency_car');

const bulkUploadReservations = async (req, res) => {
    try {

        if(req.UploadError) {

            return res.status(400).json({ success: false, message: req.UploadError.message });
        }

        // Filter our where fieldname is a file when using any and update req.file to this or to null


        // const files = req.files;

        // const File = files?.filter(file => file.fieldname === 'file')

        // req.file = File !== undefined ? File[0] : null

       

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

        // 4. Map the newly combined, single list
        const mappedVisitors = allVisitorsData.map(row => ({
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

        // 5. Save everything as ONE single database document
        const newReservationBatch = new EmergencyCar({
            total_reserved_space: mappedVisitors.length,
            visitor_info: mappedVisitors,
            validity: {
                from: new Date(),
                to: new Date(new Date().setHours(23, 59, 59, 999)) // Valid until end of today
            },
            registered_by: 'Super_Admin_Bulk_Upload' 
        });

        await newReservationBatch.save();

        res.status(201).json({
            success: true,
            message: `Successfully registered ${mappedVisitors.length} visitors sequentially from ${uploadedFiles.length} file(s).`,
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