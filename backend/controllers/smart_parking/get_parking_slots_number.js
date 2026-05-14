// this file allow to get parking slots

const ParkingSlot = require('../../models/parking_slots.js')

module.exports = async function get_parking_slots_number(req, res, next) {
    try {
        let parking_slots = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });

        // If no configuration exists, create default
        if (!parking_slots) {
            const defaultTotalSlots = 350;
            const defaultStaffReserved = 100;
            const defaultVisitorReserved = 50;
            const regularTotal = defaultTotalSlots - defaultStaffReserved - defaultVisitorReserved;

            parking_slots = new ParkingSlot({
                UnChangedId: 'parking_slots',
                totalSlots: defaultTotalSlots,
                staffReservedSlots: defaultStaffReserved,
                visitorsReservedSlots: defaultVisitorReserved,
                staffAvailableSlots: defaultStaffReserved,
                visitorsAvailableSlots: defaultVisitorReserved,
                RegularReservedSlots: 0,
                RegularAvailableSlots: regularTotal,
                staffReservationCount: 0,
                visitorReservationCount: 0,
                staffOccupiedCount: 0,
                visitorOccupiedCount: 0,
                regularOccupiedCount: 0
            });
            await parking_slots.save();
            console.log("Default parking slot configuration created.");
        }

        res.json({
            success: true,
            data: {
                available_slots: parking_slots
            }
        });
    } catch (error) {
       console.error("Error fetching parking slots:", error);
        res.status(500).json({
            success: false,
            type: 'error',
            message: "Failed to fetch parking slots. Please try again later."
        });
    }
}