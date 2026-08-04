const mongoose = require('mongoose');
const ServiceDelivery = require('../../models/service_delivery.js');
const ParkingRecord = require('../../models/parking_record.js');

module.exports = async function partial_exit(req, res, next) {
    try {
        const { visitor_id } = req.body || {};

        if (!visitor_id) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'Visitor ID is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(visitor_id)) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'Invalid Visitor ID format'
            });
        }

        const visitor = await ServiceDelivery.findById(visitor_id);

        if (!visitor || !visitor.is_still_inhouse) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: 'Visitor not found or already checked out'
            });
        }

        visitor.badge_number = null;
        visitor.marked_as_out = true;
        await visitor.save();

        let parkingRecordsUpdated = [];

        if (visitor.identification?.number) {
            const parkingRecords = await ParkingRecord.find({
                'driver_identification.number': visitor.identification.number,
                status: 'active'
            });

            for (const parkingRecord of parkingRecords) {
                parkingRecord.badge_number = null;
                await parkingRecord.save();
                parkingRecordsUpdated.push(parkingRecord);
            }
        }

        if (visitor.vehicle_storage?.has_vehicle && visitor.vehicle_storage?.vehicle_details?.plate_number) {
            const plateRecords = await ParkingRecord.find({
                plate_number: visitor.vehicle_storage.vehicle_details.plate_number,
                status: 'active'
            });

            for (const plateRecord of plateRecords) {
                if (!parkingRecordsUpdated.includes(plateRecord)) {
                    plateRecord.badge_number = null;
                    await plateRecord.save();
                    parkingRecordsUpdated.push(plateRecord);
                }
            }
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Visitor marked as outside',
            data: visitor,
            parking_records_updated: parkingRecordsUpdated.length
        });

    } catch (error) {
        console.error('Error in partial_exit:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Failed to process partial exit',
            error: error.message
        });
    }
};