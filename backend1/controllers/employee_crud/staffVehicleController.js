const mongoose = require('mongoose');
const xlsx = require('xlsx');
const StaffCar = require('../../models/staff_car'); 

/**
 * OPTION A: Single Staff Registration
 */
const registerSingleStaffCar = async (req, res) => {
    try {
        // Grab id_type from the request body
        const { plate_number, id_type, identification, owner_name, department_name, owner_title, owner_picture } = req.body;

        if (!plate_number) {
            return res.status(400).json({ success: false, message: 'Plate number is required.' });
        }

        const newStaffCar = new StaffCar({
            plate_number,
            id_type: id_type || 'NID', // Saves 'NID' if they leave it blank
            identification: identification || '',
            owner_name: owner_name || '',
            department_name: department_name || '',
            owner_title: owner_title || '',
            owner_picture: owner_picture || '',
            is_active: true,
            is_flagged: false,
            registered_by: 'Super_Admin' 
        });

        await newStaffCar.save();

        res.status(201).json({
            success: true,
            message: `Successfully registered staff vehicle for ${owner_name || plate_number}.`,
            data: newStaffCar
        });

    } catch (error) {
        console.error('❌ Error in single staff registration:', error);
        res.status(500).json({ success: false, message: 'Server error during staff registration.' });
    }
};

/**
 * OPTION B: Staff Bulk Upload
 */
const bulkUploadStaffCars = async (req, res) => {
    try {
        if (req.UploadError) return res.status(400).json({ success: false, message: req.UploadError.message });

        let uploadedFiles = [];
        if (req.files && req.files.length > 0) {
            uploadedFiles = req.files.filter(f => f.fieldname === 'file' || f.fieldname === 'files');
        } else if (req.file) {
            uploadedFiles = [req.file];
        }

        if (uploadedFiles.length === 0) {
            return res.status(400).json({ success: false, message: 'No file(s) provided.' });
        }

        let allStaffData = [];

        for (let file of uploadedFiles) {
            const workbook = xlsx.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0]; 
            const sheet = workbook.Sheets[sheetName];
            const fileData = xlsx.utils.sheet_to_json(sheet);
            allStaffData = allStaffData.concat(fileData);
        }

        if (allStaffData.length === 0) {
            return res.status(400).json({ success: false, message: 'The uploaded Excel file(s) are empty.' });
        }

        // Map the Excel columns to include ID Type
        const mappedStaff = allStaffData.map(row => ({
            plate_number: row['Plate Number'] || row['plate number'] || '',
            owner_name: row['Name'] || row['Owner Name'] || row['name'] || '',
            id_type: row['ID Type'] || row['id type'] || 'NID', // <--- Extracts ID Type from Excel
            identification: String(row['Identification'] || row['ID'] || ''),
            department_name: row['Department'] || row['department'] || '',
            owner_title: row['Title'] || row['title'] || '',
            owner_picture: '', 
            is_active: true,
            is_flagged: false,
            registered_by: 'Super_Admin_Bulk_Upload'
        }));

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            await StaffCar.insertMany(mappedStaff, { session });
            await session.commitTransaction();
            session.endSession();

            return res.status(201).json({
                success: true,
                message: `Successfully registered ${mappedStaff.length} staff vehicles.`,
                data: mappedStaff
            });

        } catch (dbError) {
            await session.abortTransaction();
            session.endSession();
            console.error('❌ Database Transaction Failed & Rolled Back:', dbError);
            return res.status(500).json({ success: false, message: 'Database error during save. All changes rolled back.' });
        }

    } catch (error) {
        console.error('❌ Error in staff bulk upload parsing:', error);
        res.status(500).json({ success: false, message: 'Server error while processing the Excel file.' });
    }
};

module.exports = {
    registerSingleStaffCar,
    bulkUploadStaffCars
};