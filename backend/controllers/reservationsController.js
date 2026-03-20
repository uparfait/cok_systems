const mongoose = require('mongoose');
const EmergencyCar = require('../models/emergency_car');
const StaffCar = require('../models/staff_car');

/**
 * Get all reservations (both visitor and staff)
 */
const getAllReservations = async (req, res) => {
    try {
        // Get visitor reservations from EmergencyCar
        const visitorReservations = await EmergencyCar.find({})
            .sort({ createdAt: -1 })
            .lean();

        // Get staff reservations from StaffCar
        const staffReservations = await StaffCar.find({})
            .sort({ createdAt: -1 })
            .lean();

        // Transform visitor reservations
        const visitors = [];
        visitorReservations.forEach(reservation => {
            if (reservation.visitor_info && reservation.visitor_info.length > 0) {
                reservation.visitor_info.forEach(visitor => {
                    visitors.push({
                        id: reservation._id.toString() + '_' + (visitor.plate_number || Math.random().toString(36).substr(2, 9)),
                        reservation_id: reservation._id,
                        visitor_name: visitor.driver_name,
                        plate_number: visitor.plate_number,
                        telephone: visitor.telephone_number,
                        expected_arrival: reservation.validity?.from ? new Date(reservation.validity.from).toISOString() : new Date().toISOString(),
                        type: 'visitor',
                        status: new Date() > new Date(reservation.validity?.to) ? 'expired' : 'active',
                        created_at: reservation.createdAt
                    });
                });
            }
        });

        // Transform staff reservations
        const staff = [];
        staffReservations.forEach(reservation => {
            staff.push({
                id: reservation._id.toString(),
                reservation_id: reservation._id,
                visitor_name: reservation.owner_name,
                plate_number: reservation.plate_number,
                telephone: reservation.telephone,
                expected_arrival: reservation.createdAt ? new Date(reservation.createdAt).toISOString() : new Date().toISOString(),
                type: 'staff',
                status: reservation.is_active ? 'active' : 'cancelled',
                created_at: reservation.createdAt
            });
        });

        // Combine and sort by date
        const allReservations = [...visitors, ...staff].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        res.status(200).json({
            success: true,
            reservations: allReservations,
            total: allReservations.length
        });
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching reservations',
            error: error.message
        });
    }
};

/**
 * Create a staff booking (permanent slot allocation)
 */
const createStaffBooking = async (req, res) => {
    try {
        const { staff_name, phone, plate_number, shift_start, slot_number, department_name, owner_title, id_type, identification } = req.body;

        if (!staff_name || !plate_number) {
            return res.status(400).json({
                success: false,
                message: 'Staff name and plate number are required'
            });
        }

        // Create new staff car record
        const newStaffBooking = new StaffCar({
            owner_name: staff_name,
            telephone: phone || '',
            plate_number,
            department_name: department_name || '',
            owner_title: owner_title || '',
            id_type: id_type || 'NID',
            identification: identification || '',
            is_active: true
        });

        await newStaffBooking.save();

        res.status(201).json({
            success: true,
            message: `Staff slot allocated for ${staff_name}`,
            data: newStaffBooking
        });
    } catch (error) {
        console.error('Error creating staff booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating staff booking',
            error: error.message
        });
    }
};

/**
 * Cancel a reservation
 */
const cancelReservation = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if it's a visitor reservation (contains underscore in ID format from our transformation)
        if (id.includes('_')) {
            // This is a visitor reservation, find by the reservation_id part
            const reservationId = id.split('_')[0];
            
            const reservation = await EmergencyCar.findById(reservationId);
            
            if (!reservation) {
                return res.status(404).json({
                    success: false,
                    message: 'Reservation not found'
                });
            }

            // Mark as expired by updating validity
            reservation.validity.to = new Date();
            await reservation.save();

            return res.status(200).json({
                success: true,
                message: 'Visitor reservation cancelled successfully'
            });
        } else {
            // This is a staff reservation
            const staffReservation = await StaffCar.findById(id);
            
            if (!staffReservation) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff reservation not found'
                });
            }

            staffReservation.is_active = false;
            await staffReservation.save();

            return res.status(200).json({
                success: true,
                message: 'Staff reservation cancelled successfully'
            });
        }
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling reservation',
            error: error.message
        });
    }
};

/**
 * Bulk upload staff reservations
 */
const bulkUploadStaff = async (req, res) => {
    try {
        if (req.UploadError) {
            return res.status(400).json({
                success: false,
                message: req.UploadError.message
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No file provided'
            });
        }

        const xlsx = require('xlsx');
        const file = req.files[0];
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'The uploaded file is empty'
            });
        }

        const staffBookings = [];
        for (const row of data) {
            const staff_name = row['Staff Name'] || row['staff_name'] || row['Name'] || row['name'];
            const plate_number = row['Plate Number'] || row['plate_number'] || row['Plate'] || row['plate'];
            
            if (staff_name && plate_number) {
                staffBookings.push({
                    owner_name: staff_name,
                    plate_number,
                    telephone: String(row['Phone'] || row['phone'] || row['Telephone'] || ''),
                    department_name: String(row['Department'] || row['department'] || ''),
                    owner_title: String(row['Title'] || row['title'] || ''),
                    id_type: String(row['ID Type'] || row['id_type'] || 'NID'),
                    identification: String(row['ID Number'] || row['id_number'] || ''),
                    is_active: true
                });
            }
        }

        if (staffBookings.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid staff records found in the file'
            });
        }

        // Insert all staff bookings
        await StaffCar.insertMany(staffBookings);

        res.status(201).json({
            success: true,
            message: `Successfully uploaded ${staffBookings.length} staff reservations`,
            count: staffBookings.length
        });
    } catch (error) {
        console.error('Error in bulk staff upload:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading staff reservations',
            error: error.message
        });
    }
};

module.exports = {
    getAllReservations,
    createStaffBooking,
    cancelReservation,
    bulkUploadStaff
};
