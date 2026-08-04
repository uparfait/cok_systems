const mongoose = require('mongoose');
const ServiceDelivery = require('../../models/service_delivery.js');
const ParkingRecord = require('../../models/parking_record.js');

module.exports = async function return_visitor(req, res, next) {
    try {
        const { visitor_id, badge_number } = req.body || {};

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

        if (!visitor) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: 'Visitor not found'
            });
        }

        if (badge_number) {
            const trimmedBadge = badge_number.toString().trim().toUpperCase();

            const existingBadgeInServiceDelivery = await ServiceDelivery.findOne({
                badge_number: trimmedBadge,
                is_still_inhouse: true
            });

            const existingBadgeInParking = await ParkingRecord.findOne({
                badge_number: trimmedBadge,
                status: 'active'
            });

            if (existingBadgeInServiceDelivery || existingBadgeInParking) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: 'Someone with this badge number is already checked in.'
                });
            }

            visitor.badge_number = trimmedBadge;
        } else {
            visitor.badge_number = null;
        }

        visitor.marked_as_out = false;

        await visitor.save();

        let parkingRecordsUpdated = [];

        if (visitor.identification?.number) {
            const parkingRecords = await ParkingRecord.find({
                'driver_identification.number': visitor.identification.number,
                status: 'active'
            });

            for (const parkingRecord of parkingRecords) {
                parkingRecord.badge_number = visitor.badge_number;
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
                    plateRecord.badge_number = visitor.badge_number;
                    await plateRecord.save();
                    parkingRecordsUpdated.push(plateRecord);
                }
            }
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: visitor.badge_number
                ? `Visitor returned with badge ${visitor.badge_number}`
                : 'Visitor returned. Badge cleared.',
            data: visitor,
            parking_records_updated: parkingRecordsUpdated.length
        });

    } catch (error) {
        console.error('Error in return_visitor:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Failed to process return',
            error: error.message
        });
    }
};