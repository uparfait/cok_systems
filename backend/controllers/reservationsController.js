const mongoose = require('mongoose');
const EmergencyCar = require('../models/emergency_car');
const EmergencyCarHistory = require('../models/emergency_car_history');
const StaffCar = require('../models/staff_car');
const ParkingSlot = require('../models/parking_slots');
const ParkingRecord = require('../models/parking_record');
const { normalizePlate, parseTemplateDate } = require('../utilities/reservationUtils');

/**
 * Auto-cancel reservations (visitor entries AND staff cars) whose End Date has passed.
 * Runs lazily whenever the reservation list is fetched; expired entries are marked
 * cancelled and the pending-reservation counters are decremented accordingly.
 */
const autoCancelExpiredReservations = async () => {
    const now = new Date();
    const docs = await EmergencyCar.find({
        is_active: true,
        visitor_info: { $elemMatch: { is_used: { $ne: true }, is_cancelled: { $ne: true }, valid_until: { $ne: null, $lt: now } } }
    });
    let expiredCount = 0;
    for (const doc of docs) {
        doc.visitor_info.forEach(v => {
            if (!v.is_used && !v.is_cancelled && v.valid_until && v.valid_until < now) {
                v.is_cancelled = true;
                expiredCount++;
            }
        });
        if (doc.visitor_info.every(v => v.is_cancelled)) doc.is_active = false;
        await doc.save();
    }

    // Staff cars with a window that ended are deactivated the same way
    const expiredStaff = await StaffCar.find({ is_active: true, valid_until: { $ne: null, $lt: now } });
    for (const car of expiredStaff) {
        car.is_active = false;
        await car.save();
    }

    if (expiredCount > 0 || expiredStaff.length > 0) {
        const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
        if (parkingSlot) {
            parkingSlot.visitorReservationCount = Math.max(0, (parkingSlot.visitorReservationCount || 0) - expiredCount);
            parkingSlot.staffReservationCount = Math.max(0, (parkingSlot.staffReservationCount || 0) - expiredStaff.length);
            await parkingSlot.save();
        }
        global.WebsocketIO?.emit('parking_update', { type: 'info', message: `${expiredCount + expiredStaff.length} expired reservation(s) auto-cancelled` });
    }
    return expiredCount + expiredStaff.length;
};

/**
 * Get all reservations (both visitor and staff)
 */
const getAllReservations = async (req, res) => {
    try {
        // Expired reservations (per-row Date column) are cancelled automatically before listing
        try { await autoCancelExpiredReservations(); } catch (e) { console.error('Auto-cancel sweep failed:', e); }

        // Get ALL visitor reservations from EmergencyCar (including cancelled)
        const visitorReservations = await EmergencyCar.find({})
            .sort({ createdAt: -1 })
            .lean();

        // Also get from EmergencyCarHistory as fallback
        const historyReservations = await EmergencyCarHistory.find({})
            .sort({ createdAt: -1 })
            .lean();

        // Get staff reservations from StaffCar (both active and inactive for reactivation)
        const staffReservations = await StaffCar.find({})
            .sort({ createdAt: -1 })
            .lean();

        // Plates currently inside the parking — a reservation whose vehicle is checked in
        // reports status 'checked_in' so maps/cards count it as occupied, not reserved
        const activeRecords = await ParkingRecord.find({ status: 'active' }).select('plate_number').lean();
        const insidePlates = new Set(activeRecords.map(r => normalizePlate(r.plate_number)));

        // Transform visitor reservations (from EmergencyCar)
        const visitors = [];
        visitorReservations.forEach(reservation => {
            if (reservation.visitor_info && reservation.visitor_info.length > 0) {
                reservation.visitor_info.forEach(visitor => {
                    // Reservations never expire: cancelled (doc or visitor level), checked_in while
                    // the vehicle is inside, used once it has arrived, otherwise active
                    let status = 'active';
                    if (reservation.is_active === false || visitor.is_cancelled) {
                        status = 'cancelled';
                    } else if (insidePlates.has(normalizePlate(visitor.plate_number))) {
                        status = 'checked_in';
                    } else if (visitor.is_used) {
                        status = 'used';
                    }
                    // Each visitor entry is identified by its own subdocument _id (plate as legacy fallback)
                    visitors.push({
                        id: visitor._id ? String(visitor._id) : (visitor.plate_number || visitor.driver_name),
                        reservation_id: reservation._id,
                        visitor_name: visitor.driver_name,
                        plate_number: visitor.plate_number,
                        telephone: visitor.telephone_number,
                        id_type: visitor.driver_identification?.id_type || visitor.id_type,
                        id_number: visitor.driver_identification?.number || visitor.id_number,
                        expected_arrival: reservation.validity?.from ? new Date(reservation.validity.from).toISOString() : new Date().toISOString(),
                        valid_from: visitor.valid_from || null,
                        valid_until: visitor.valid_until || null,
                        type: 'visitor',
                        status: status,
                        created_at: reservation.createdAt
                    });
                });
            }
        });

        // Also transform history reservations (from EmergencyCarHistory) as fallback
        historyReservations.forEach(reservation => {
            if (reservation.visitor_info && reservation.visitor_info.length > 0) {
                reservation.visitor_info.forEach(visitor => {
                    // Reservations never expire: cancelled (doc or visitor level), checked_in while
                    // the vehicle is inside, used once it has arrived, otherwise active
                    let status = 'active';
                    if (reservation.is_active === false || visitor.is_cancelled) {
                        status = 'cancelled';
                    } else if (insidePlates.has(normalizePlate(visitor.plate_number))) {
                        status = 'checked_in';
                    } else if (visitor.is_used) {
                        status = 'used';
                    }
                    // Each visitor entry is identified by its own subdocument _id (plate as legacy fallback)
                    visitors.push({
                        id: visitor._id ? String(visitor._id) : (visitor.plate_number || visitor.driver_name),
                        reservation_id: reservation._id,
                        visitor_name: visitor.driver_name,
                        plate_number: visitor.plate_number,
                        telephone: visitor.telephone_number,
                        id_type: visitor.driver_identification?.id_type || visitor.id_type,
                        id_number: visitor.driver_identification?.number || visitor.id_number,
                        expected_arrival: reservation.validity?.from ? new Date(reservation.validity.from).toISOString() : new Date().toISOString(),
                        valid_from: visitor.valid_from || null,
                        valid_until: visitor.valid_until || null,
                        type: 'visitor',
                        status: status,
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
                id_type: reservation.id_type,
                id_number: reservation.identification,
                expected_arrival: reservation.createdAt ? new Date(reservation.createdAt).toISOString() : new Date().toISOString(),
                valid_from: reservation.valid_from || null,
                valid_until: reservation.valid_until || null,
                type: 'staff',
                status: !reservation.is_active ? 'cancelled'
                    : insidePlates.has(normalizePlate(reservation.plate_number)) ? 'checked_in'
                    : 'active',
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
            plate_number: normalizePlate(plate_number),
            department_name: department_name || '',
            owner_title: owner_title || '',
            id_type: id_type || 'NID',
            identification: identification || '',
            is_active: true
        });

        await newStaffBooking.save();

// Increment staff reservation count (do NOT affect RegularAvailableSlots)
         try {
             const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
             if (parkingSlot) {
                 parkingSlot.staffReservationCount = (parkingSlot.staffReservationCount || 0) + 1;
                 await parkingSlot.save();
             } else {
                 console.error('ParkingSlot document not found');
             }
         } catch (slotError) {
             console.error('Error updating parking slots:', slotError);
         }

        // Live-refresh dashboards showing reserved counts / the parking status map
        global.WebsocketIO?.emit('parking_update', { type: 'info', message: 'New staff slot allocated' });

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

        // The frontend sends the reservation type explicitly (visitor entries now have their own
        // ObjectIds too, so the old id-shape heuristic is only kept as a legacy fallback)
        const { type } = req.body || {};
        const isStaffReservation = type ? type === 'staff' : (id.length === 24 && !id.includes('_'));

        if (isStaffReservation) {
            // This is a staff reservation - use MongoDB ObjectId
            const staffReservation = await StaffCar.findById(id);
            
            if (!staffReservation) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff reservation not found'
                });
            }

            // Only restore the slot if not already checked in
            const ParkingRecord = require('../models/parking_record');
            const activeCheckIn = await ParkingRecord.findOne({ 
                plate_number: staffReservation.plate_number, 
                status: 'active' 
            });
            
if (!activeCheckIn) {
                 const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
                 if (parkingSlot) {
                     parkingSlot.staffReservationCount = Math.max(0, (parkingSlot.staffReservationCount || 0) - 1);
                     await parkingSlot.save();
                 }
             }

            staffReservation.is_active = false;
            await staffReservation.save();

            global.WebsocketIO?.emit('parking_update', { type: 'info', message: 'Staff reservation cancelled' });

            return res.status(200).json({
                success: true,
                message: 'Staff reservation cancelled successfully'
            });
        } else {
            // This is a visitor reservation - the id is the visitor entry's own ObjectId
            // (or a plate number for legacy rows). Bulk uploads share one document, so
            // cancellation is per visitor — never the whole batch.
            const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
            let reservation = null;
            if (isObjectId) {
                reservation = await EmergencyCar.findOne({ is_active: true, 'visitor_info._id': id });
            }
            if (!reservation) {
                reservation = await EmergencyCar.findOne({ is_active: true, 'visitor_info.plate_number': id });
            }

            if (!reservation) {
                return res.status(404).json({
                    success: false,
                    message: 'Reservation not found'
                });
            }

            const visitorEntry = (isObjectId && reservation.visitor_info.id(id))
                || reservation.visitor_info.find(v => v.plate_number === id && !v.is_cancelled);
            if (!visitorEntry || visitorEntry.is_cancelled) {
                return res.status(404).json({
                    success: false,
                    message: 'Reservation not found or already cancelled'
                });
            }

            const wasPending = !visitorEntry.is_used;
            visitorEntry.is_cancelled = true;

            // Deactivate the batch document only when every visitor in it is cancelled
            if (reservation.visitor_info.every(v => v.is_cancelled)) {
                reservation.is_active = false;
                reservation.validity.to = new Date();
            }
            await reservation.save();

            // Decrement the pending-reservation count only if this one wasn't already consumed by a check-in
            if (wasPending) {
                const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
                if (parkingSlot) {
                    parkingSlot.visitorReservationCount = Math.max(0, (parkingSlot.visitorReservationCount || 0) - 1);
                    await parkingSlot.save();
                }
            }

            global.WebsocketIO?.emit('parking_update', { type: 'info', message: 'Visitor reservation cancelled' });

            return res.status(200).json({
                success: true,
                message: `Reservation for plate number ${visitorEntry.plate_number} has been cancelled successfully`,
                cancelled_plate_number: visitorEntry.plate_number
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
 * Reactivate a cancelled staff reservation
 */
const reactivateReservation = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if it's a valid MongoDB ObjectId
        if (!id || id.length !== 24) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reservation ID'
            });
        }

        const staffReservation = await StaffCar.findById(id);
        
        if (!staffReservation) {
            return res.status(404).json({
                success: false,
                message: 'Staff reservation not found'
            });
        }

        // Check if already active
        if (staffReservation.is_active === true) {
            return res.status(400).json({
                success: false,
                message: 'Reservation is already active'
            });
        }

        // Check if currently checked in (occupied)
        const ParkingRecord = require('../models/parking_record');
        const activeCheckIn = await ParkingRecord.findOne({ 
            plate_number: staffReservation.plate_number, 
            status: 'active' 
        });
        
        if (activeCheckIn) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reactivate reservation while staff is checked in'
            });
        }

// Reactivate the reservation
        const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
        if (parkingSlot) {
            parkingSlot.staffReservationCount = (parkingSlot.staffReservationCount || 0) + 1;
            await parkingSlot.save();
        }

        staffReservation.is_active = true;
        await staffReservation.save();

        global.WebsocketIO?.emit('parking_update', { type: 'info', message: 'Staff reservation reactivated' });

        return res.status(200).json({
            success: true,
            message: `Staff reservation for ${staffReservation.owner_name} has been reactivated successfully`,
            data: staffReservation
        });
    } catch (error) {
        console.error('Error reactivating reservation:', error);
        res.status(500).json({
            success: false,
            message: 'Error reactivating reservation',
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

        const batchName = file.originalname || null;
        const staffBookings = [];
        for (const row of data) {
            const staff_name = row['Staff Name'] || row['staff_name'] || row['Name'] || row['name'];
            const plate_number = row['Plate Number'] || row['plate_number'] || row['Plate'] || row['plate'];

            if (staff_name && plate_number) {
                staffBookings.push({
                    owner_name: staff_name,
                    plate_number: normalizePlate(plate_number),
                    telephone: String(row['Phone'] || row['phone'] || row['Telephone'] || ''),
                    department_name: String(row['Department'] || row['department'] || ''),
                    owner_title: String(row['Title'] || row['title'] || ''),
                    id_type: String(row['ID Type'] || row['id_type'] || 'NID'),
                    identification: String(row['ID Number'] || row['id_number'] || ''),
                    valid_from: parseTemplateDate(row['Start Date'] || row['start date'] || row['Start'] || row['start'], false),
                    valid_until: parseTemplateDate(row['End Date'] || row['end date'] || row['End'] || row['end'] || row['Date'] || row['date'], true),
                    batch_name: batchName,
                    is_active: true
                });
            }
        }

        // Same window rules as visitor uploads: End Date in the past or Start after End = skipped
        const uploadTime = new Date();
        const isBadRow = (v) => (v.valid_until && v.valid_until < uploadTime)
            || (v.valid_from && v.valid_until && v.valid_from > v.valid_until);
        const skippedRows = staffBookings.filter(isBadRow);
        const validBookings = staffBookings.filter(v => !isBadRow(v));

        if (validBookings.length === 0) {
            return res.status(400).json({
                success: false,
                message: staffBookings.length === 0
                    ? 'No valid staff records found in the file'
                    : `All ${skippedRows.length} row(s) have an End Date that already passed or a Start Date after the End Date (format is day/month/year). Nothing was registered.`
            });
        }

        // Insert all staff bookings
        await StaffCar.insertMany(validBookings);

// Increment reservation count (do NOT affect RegularAvailableSlots)
         const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
         if (parkingSlot) {
             parkingSlot.staffReservationCount = (parkingSlot.staffReservationCount || 0) + validBookings.length;
             await parkingSlot.save();
         }

        // Live-refresh dashboards showing reserved counts / the parking status map
        global.WebsocketIO?.emit('parking_update', { type: 'info', message: `${validBookings.length} staff reservations uploaded` });

        res.status(201).json({
            success: true,
            message: `Successfully uploaded ${validBookings.length} staff reservation(s).`
                + (skippedRows.length ? ` ${skippedRows.length} row(s) skipped — End Date already passed or Start Date after End Date (format is day/month/year).` : ''),
            count: validBookings.length
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

/**
 * Shared per-item worker for the bulk endpoints.
 * mode 'cancel' marks the reservation cancelled; mode 'delete' removes it permanently.
 * Returns true when the item was processed.
 */
const processReservationItem = async (item, mode, counters) => {
    const id = String(item?.id || '');
    const type = item?.type;
    if (!id) return false;

    if (type === 'staff') {
        const staffReservation = await StaffCar.findById(id);
        if (!staffReservation) return false;

        // Restore the pending count only when the reservation was active and its car is not inside
        if (staffReservation.is_active) {
            const activeCheckIn = await ParkingRecord.findOne({ plate_number: staffReservation.plate_number, status: 'active' });
            if (!activeCheckIn) counters.staff++;
        }

        if (mode === 'delete') {
            await StaffCar.findByIdAndDelete(id);
        } else {
            if (!staffReservation.is_active) return false; // already cancelled
            staffReservation.is_active = false;
            await staffReservation.save();
        }
        return true;
    }

    // Visitor entry: located by its subdocument _id (plate number as legacy fallback)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    let reservation = null;
    if (isObjectId) reservation = await EmergencyCar.findOne({ 'visitor_info._id': id });
    if (!reservation) reservation = await EmergencyCar.findOne({ 'visitor_info.plate_number': id });
    if (!reservation) return false;

    const entry = (isObjectId && reservation.visitor_info.id(id))
        || reservation.visitor_info.find(v => v.plate_number === id);
    if (!entry) return false;

    const wasPending = reservation.is_active && !entry.is_used && !entry.is_cancelled;

    if (mode === 'delete') {
        reservation.visitor_info.pull(entry._id);
        if (reservation.visitor_info.length === 0) {
            await EmergencyCar.deleteOne({ _id: reservation._id });
        } else {
            if (reservation.visitor_info.every(v => v.is_cancelled)) reservation.is_active = false;
            await reservation.save();
        }
    } else {
        if (entry.is_cancelled) return false;
        entry.is_cancelled = true;
        if (reservation.visitor_info.every(v => v.is_cancelled)) reservation.is_active = false;
        await reservation.save();
    }

    if (wasPending) counters.visitor++;
    return true;
};

/**
 * Bulk cancel / bulk delete selected reservations.
 * Body: { items: [{ id, type: 'visitor' | 'staff' }] }
 */
const bulkReservationAction = (mode) => async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (items.length === 0) {
            return res.status(400).json({ success: false, message: 'No reservations selected' });
        }

        const counters = { visitor: 0, staff: 0 };
        let processed = 0;
        for (const item of items) {
            try {
                if (await processReservationItem(item, mode, counters)) processed++;
            } catch (itemError) {
                console.error(`Bulk ${mode} failed for item`, item, itemError);
            }
        }

        // Restore pending-reservation counters in one write
        if (counters.visitor > 0 || counters.staff > 0) {
            const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
            if (parkingSlot) {
                parkingSlot.visitorReservationCount = Math.max(0, (parkingSlot.visitorReservationCount || 0) - counters.visitor);
                parkingSlot.staffReservationCount = Math.max(0, (parkingSlot.staffReservationCount || 0) - counters.staff);
                await parkingSlot.save();
            }
        }

        if (processed > 0) {
            global.WebsocketIO?.emit('parking_update', { type: 'info', message: `${processed} reservation(s) ${mode === 'delete' ? 'deleted' : 'cancelled'}` });
        }

        return res.status(200).json({
            success: true,
            message: `${processed} of ${items.length} reservation(s) ${mode === 'delete' ? 'deleted' : 'cancelled'}`,
            processed,
            requested: items.length
        });
    } catch (error) {
        console.error(`Error in bulk ${mode}:`, error);
        return res.status(500).json({ success: false, message: `Error during bulk ${mode}`, error: error.message });
    }
};

const bulkCancelReservations = bulkReservationAction('cancel');
const bulkDeleteReservations = bulkReservationAction('delete');

/**
 * List upload batches: visitor uploads (one EmergencyCar document each) and staff
 * uploads (StaffCar records grouped by their file name). Searchable by file name.
 */
const getReservationBatches = async (req, res) => {
    try {
        try { await autoCancelExpiredReservations(); } catch (e) { console.error('Auto-cancel sweep failed:', e); }

        const batches = [];

        const visitorDocs = await EmergencyCar.find({ batch_name: { $ne: null } }).lean();
        for (const doc of visitorDocs) {
            const entries = doc.visitor_info || [];
            const starts = entries.map(v => v.valid_from).filter(Boolean).map(d => new Date(d).getTime());
            const ends = entries.map(v => v.valid_until).filter(Boolean).map(d => new Date(d).getTime());
            batches.push({
                id: doc._id.toString(),
                type: 'visitor',
                batch_name: doc.batch_name,
                uploaded_at: doc._id.getTimestamp(),
                total: entries.length,
                active: entries.filter(v => !v.is_used && !v.is_cancelled).length,
                used: entries.filter(v => v.is_used).length,
                cancelled: entries.filter(v => v.is_cancelled && !v.is_used).length,
                start_date: starts.length ? new Date(Math.min(...starts)) : null,
                end_date: ends.length ? new Date(Math.max(...ends)) : null
            });
        }

        const staffDocs = await StaffCar.find({ batch_name: { $ne: null } }).lean();
        const byName = new Map();
        staffDocs.forEach(c => {
            if (!byName.has(c.batch_name)) byName.set(c.batch_name, []);
            byName.get(c.batch_name).push(c);
        });
        for (const [name, cars] of byName) {
            const starts = cars.map(c => c.valid_from).filter(Boolean).map(d => new Date(d).getTime());
            const ends = cars.map(c => c.valid_until).filter(Boolean).map(d => new Date(d).getTime());
            batches.push({
                id: name,
                type: 'staff',
                batch_name: name,
                uploaded_at: cars[0]?._id ? cars[0]._id.getTimestamp() : null,
                total: cars.length,
                active: cars.filter(c => c.is_active).length,
                used: 0,
                cancelled: cars.filter(c => !c.is_active).length,
                start_date: starts.length ? new Date(Math.min(...starts)) : null,
                end_date: ends.length ? new Date(Math.max(...ends)) : null
            });
        }

        batches.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
        return res.status(200).json({ success: true, batches, total: batches.length });
    } catch (error) {
        console.error('Error listing reservation batches:', error);
        return res.status(500).json({ success: false, message: 'Error listing reservation batches', error: error.message });
    }
};

/**
 * Cancel every pending reservation in an uploaded batch.
 * Body: { id, type: 'visitor' | 'staff' } — visitor id is the batch document id,
 * staff id is the batch (file) name.
 */
const cancelReservationBatch = async (req, res) => {
    try {
        const { id, type } = req.body || {};
        if (!id || !type) return res.status(400).json({ success: false, message: 'Batch id and type are required' });

        let cancelledPending = 0;

        if (type === 'visitor') {
            const doc = await EmergencyCar.findById(id);
            if (!doc) return res.status(404).json({ success: false, message: 'Batch not found' });
            doc.visitor_info.forEach(v => {
                if (!v.is_used && !v.is_cancelled) { v.is_cancelled = true; cancelledPending++; }
            });
            if (doc.visitor_info.every(v => v.is_cancelled || v.is_used)) doc.is_active = false;
            await doc.save();

            const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
            if (parkingSlot && cancelledPending > 0) {
                parkingSlot.visitorReservationCount = Math.max(0, (parkingSlot.visitorReservationCount || 0) - cancelledPending);
                await parkingSlot.save();
            }
        } else {
            const cars = await StaffCar.find({ batch_name: id, is_active: true });
            if (cars.length === 0) return res.status(404).json({ success: false, message: 'No active reservations found in this batch' });
            for (const car of cars) {
                const inside = await ParkingRecord.findOne({ plate_number: car.plate_number, status: 'active' });
                car.is_active = false;
                await car.save();
                if (!inside) cancelledPending++;
            }
            const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
            if (parkingSlot && cancelledPending > 0) {
                parkingSlot.staffReservationCount = Math.max(0, (parkingSlot.staffReservationCount || 0) - cancelledPending);
                await parkingSlot.save();
            }
        }

        global.WebsocketIO?.emit('parking_update', { type: 'info', message: `Reservation batch cancelled (${cancelledPending} pending entries)` });
        return res.status(200).json({ success: true, message: `Batch cancelled — ${cancelledPending} pending reservation(s) released`, cancelled: cancelledPending });
    } catch (error) {
        console.error('Error cancelling reservation batch:', error);
        return res.status(500).json({ success: false, message: 'Error cancelling reservation batch', error: error.message });
    }
};

/**
 * Reschedule an uploaded batch: the given Start/End dates REPLACE the dates from the
 * file for every entry that has not been used yet. Cancelled/expired entries are
 * revived so the whole upload becomes valid for the new window.
 * Body: { id, type: 'visitor' | 'staff', start_date, end_date }
 */
const rescheduleReservationBatch = async (req, res) => {
    try {
        const { id, type, start_date, end_date } = req.body || {};
        if (!id || !type) return res.status(400).json({ success: false, message: 'Batch id and type are required' });

        const newFrom = parseTemplateDate(start_date, false);
        const newUntil = parseTemplateDate(end_date, true);
        if (end_date && !newUntil) return res.status(400).json({ success: false, message: 'End date is not a valid date' });
        if (start_date && !newFrom) return res.status(400).json({ success: false, message: 'Start date is not a valid date' });
        if (newUntil && newUntil < new Date()) return res.status(400).json({ success: false, message: 'The new End Date has already passed' });
        if (newFrom && newUntil && newFrom > newUntil) return res.status(400).json({ success: false, message: 'Start Date must be before End Date' });

        let updated = 0;
        let revived = 0;

        if (type === 'visitor') {
            const doc = await EmergencyCar.findById(id);
            if (!doc) return res.status(404).json({ success: false, message: 'Batch not found' });
            doc.visitor_info.forEach(v => {
                if (v.is_used) return; // the vehicle already came — nothing to reschedule
                v.valid_from = newFrom;
                v.valid_until = newUntil;
                if (v.is_cancelled) { v.is_cancelled = false; revived++; }
                updated++;
            });
            doc.is_active = true;
            await doc.save();

            const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
            if (parkingSlot && revived > 0) {
                parkingSlot.visitorReservationCount = (parkingSlot.visitorReservationCount || 0) + revived;
                await parkingSlot.save();
            }
        } else {
            const cars = await StaffCar.find({ batch_name: id });
            if (cars.length === 0) return res.status(404).json({ success: false, message: 'Batch not found' });
            for (const car of cars) {
                car.valid_from = newFrom;
                car.valid_until = newUntil;
                if (!car.is_active) { car.is_active = true; revived++; }
                await car.save();
                updated++;
            }
            const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
            if (parkingSlot && revived > 0) {
                parkingSlot.staffReservationCount = (parkingSlot.staffReservationCount || 0) + revived;
                await parkingSlot.save();
            }
        }

        global.WebsocketIO?.emit('parking_update', { type: 'info', message: 'Reservation batch rescheduled' });
        return res.status(200).json({
            success: true,
            message: `${updated} reservation(s) rescheduled${revived ? ` (${revived} reactivated)` : ''}`,
            updated,
            revived
        });
    } catch (error) {
        console.error('Error rescheduling reservation batch:', error);
        return res.status(500).json({ success: false, message: 'Error rescheduling reservation batch', error: error.message });
    }
};

/**
 * Permanently delete an uploaded batch and every reservation in it.
 * Body: { id, type: 'visitor' | 'staff' } — visitor id is the batch document id,
 * staff id is the batch (file) name.
 */
const deleteReservationBatch = async (req, res) => {
    try {
        const { id, type } = req.body || {};
        if (!id || !type) return res.status(400).json({ success: false, message: 'Batch id and type are required' });

        let deleted = 0;
        let releasedPending = 0; // pending entries whose slot counter must be given back

        if (type === 'visitor') {
            const doc = await EmergencyCar.findById(id);
            if (!doc) return res.status(404).json({ success: false, message: 'Batch not found' });
            deleted = doc.visitor_info.length;
            releasedPending = doc.visitor_info.filter(v => !v.is_used && !v.is_cancelled).length;
            await EmergencyCar.deleteOne({ _id: doc._id });

            const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
            if (parkingSlot && releasedPending > 0) {
                parkingSlot.visitorReservationCount = Math.max(0, (parkingSlot.visitorReservationCount || 0) - releasedPending);
                await parkingSlot.save();
            }
        } else {
            const cars = await StaffCar.find({ batch_name: id });
            if (cars.length === 0) return res.status(404).json({ success: false, message: 'Batch not found' });
            for (const car of cars) {
                if (car.is_active) {
                    const inside = await ParkingRecord.findOne({ plate_number: car.plate_number, status: 'active' });
                    if (!inside) releasedPending++;
                }
                await StaffCar.deleteOne({ _id: car._id });
                deleted++;
            }
            const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
            if (parkingSlot && releasedPending > 0) {
                parkingSlot.staffReservationCount = Math.max(0, (parkingSlot.staffReservationCount || 0) - releasedPending);
                await parkingSlot.save();
            }
        }

        global.WebsocketIO?.emit('parking_update', { type: 'info', message: `Reservation batch deleted (${deleted} entries)` });
        return res.status(200).json({ success: true, message: `Batch deleted — ${deleted} reservation(s) removed`, deleted });
    } catch (error) {
        console.error('Error deleting reservation batch:', error);
        return res.status(500).json({ success: false, message: 'Error deleting reservation batch', error: error.message });
    }
};

/**
 * Reschedule ONE reservation: the given Start/End dates replace its current window.
 * A cancelled/expired entry is revived for the new window; a used one is refused.
 * Params: :id — Body: { type: 'visitor' | 'staff', start_date, end_date }
 */
const rescheduleReservation = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, start_date, end_date } = req.body || {};

        const newFrom = parseTemplateDate(start_date, false);
        const newUntil = parseTemplateDate(end_date, true);
        if (start_date && !newFrom) return res.status(400).json({ success: false, message: 'Start date is not a valid date' });
        if (end_date && !newUntil) return res.status(400).json({ success: false, message: 'End date is not a valid date' });
        if (newUntil && newUntil < new Date()) return res.status(400).json({ success: false, message: 'The new End Date has already passed' });
        if (newFrom && newUntil && newFrom > newUntil) return res.status(400).json({ success: false, message: 'Start Date must be before End Date' });

        // Same type resolution as cancelReservation (id-shape heuristic kept as legacy fallback)
        const isStaffReservation = type ? type === 'staff' : (id.length === 24 && !id.includes('_'));
        let revived = false;

        if (isStaffReservation) {
            const car = await StaffCar.findById(id);
            if (!car) return res.status(404).json({ success: false, message: 'Staff reservation not found' });
            car.valid_from = newFrom;
            car.valid_until = newUntil;
            if (!car.is_active) { car.is_active = true; revived = true; }
            await car.save();

            if (revived) {
                const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
                if (parkingSlot) {
                    parkingSlot.staffReservationCount = (parkingSlot.staffReservationCount || 0) + 1;
                    await parkingSlot.save();
                }
            }
        } else {
            // Visitor entry id is its own subdocument ObjectId (plate number as legacy fallback)
            const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
            let doc = null;
            if (isObjectId) doc = await EmergencyCar.findOne({ 'visitor_info._id': id });
            if (!doc) doc = await EmergencyCar.findOne({ 'visitor_info.plate_number': id });
            if (!doc) return res.status(404).json({ success: false, message: 'Reservation not found' });

            const entry = (isObjectId && doc.visitor_info.id(id))
                || doc.visitor_info.find(v => v.plate_number === id);
            if (!entry) return res.status(404).json({ success: false, message: 'Reservation not found' });
            if (entry.is_used) return res.status(400).json({ success: false, message: 'The vehicle already arrived — nothing to reschedule' });

            entry.valid_from = newFrom;
            entry.valid_until = newUntil;
            if (entry.is_cancelled) { entry.is_cancelled = false; revived = true; }
            doc.is_active = true;
            await doc.save();

            if (revived) {
                const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
                if (parkingSlot) {
                    parkingSlot.visitorReservationCount = (parkingSlot.visitorReservationCount || 0) + 1;
                    await parkingSlot.save();
                }
            }
        }

        global.WebsocketIO?.emit('parking_update', { type: 'info', message: 'Reservation rescheduled' });
        return res.status(200).json({ success: true, message: `Reservation rescheduled${revived ? ' (reactivated)' : ''}`, revived });
    } catch (error) {
        console.error('Error rescheduling reservation:', error);
        return res.status(500).json({ success: false, message: 'Error rescheduling reservation', error: error.message });
    }
};

module.exports = {
    getAllReservations,
    createStaffBooking,
    cancelReservation,
    reactivateReservation,
    rescheduleReservation,
    bulkUploadStaff,
    bulkCancelReservations,
    bulkDeleteReservations,
    getReservationBatches,
    cancelReservationBatch,
    rescheduleReservationBatch,
    deleteReservationBatch
};
