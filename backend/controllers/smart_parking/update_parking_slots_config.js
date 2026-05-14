// Update parking slot configuration

const ParkingSlot = require('../../models/parking_slots.js')

module.exports = async function update_parking_slots_config(req, res, next) {
    try {
        const { totalSlots, staffReservedSlots, visitorReservedSlots } = req.body;

        // Validate input
        if (totalSlots === undefined || staffReservedSlots === undefined || visitorReservedSlots === undefined) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: "Missing required fields: totalSlots, staffReservedSlots, visitorReservedSlots"
            });
        }

        if (totalSlots < 0 || staffReservedSlots < 0 || visitorReservedSlots < 0) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: "Slot values cannot be negative"
            });
        }

        if (staffReservedSlots + visitorReservedSlots > totalSlots) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: "Staff reserved + visitor reserved slots cannot exceed total slots"
            });
        }

        // Find the parking slot document
        const parkingSlot = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });

        if (!parkingSlot) {
            return res.status(404).json({
                success: false,
                type: 'error',
                message: "Parking slot configuration not found"
            });
        }

        // Get current occupancy counts (these should not change when capacity changes)
        const staffOccupiedCount = parkingSlot.staffOccupiedCount || 0;
        const visitorOccupiedCount = parkingSlot.visitorOccupiedCount || 0;
        const regularOccupiedCount = parkingSlot.regularOccupiedCount || 0;
        const regularReservedSlots = parkingSlot.RegularReservedSlots || 0;

        // Validate that new capacities are sufficient for current occupancy
        if (staffReservedSlots < staffOccupiedCount) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: `Staff reserved slots (${staffReservedSlots}) cannot be less than currently occupied staff vehicles (${staffOccupiedCount})`
            });
        }

        if (visitorReservedSlots < visitorOccupiedCount) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: `Visitor reserved slots (${visitorReservedSlots}) cannot be less than currently occupied visitor vehicles (${visitorOccupiedCount})`
            });
        }

        // Calculate new regular capacity
        const regularTotal = totalSlots - staffReservedSlots - visitorReservedSlots;
        if (regularTotal < 0) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: "Calculated regular slots cannot be negative. Adjust your configuration."
            });
        }

        // Check if new regular capacity can accommodate current reserved + occupied
        if (regularTotal < regularOccupiedCount + regularReservedSlots) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: `Regular capacity (${regularTotal}) is insufficient to hold currently reserved (${regularReservedSlots}) and occupied (${regularOccupiedCount}) regular vehicles. Please increase total slots or reduce other reserved slots.`
            });
        }

        // Compute new available slots (capacity minus occupied)
        const newStaffAvailable = Math.max(0, staffReservedSlots - staffOccupiedCount);
        const newVisitorAvailable = Math.max(0, visitorReservedSlots - visitorOccupiedCount);
        const newRegularAvailable = regularTotal - regularOccupiedCount - regularReservedSlots;

        // Update the parking slot configuration
        parkingSlot.totalSlots = totalSlots;
        parkingSlot.staffReservedSlots = staffReservedSlots;
        parkingSlot.visitorsReservedSlots = visitorReservedSlots;

        parkingSlot.staffAvailableSlots = newStaffAvailable;
        parkingSlot.visitorsAvailableSlots = newVisitorAvailable;
        // Keep RegularReservedSlots as is (reservations from regular pool)
        parkingSlot.RegularReservedSlots = regularReservedSlots;
        parkingSlot.RegularAvailableSlots = newRegularAvailable;

        await parkingSlot.save();

        res.json({
            success: true,
            type: 'success',
            message: "Parking slot configuration updated successfully",
            data: {
                totalSlots: parkingSlot.totalSlots,
                staffReservedSlots: parkingSlot.staffReservedSlots,
                visitorReservedSlots: parkingSlot.visitorsReservedSlots,
                staffAvailableSlots: parkingSlot.staffAvailableSlots,
                visitorAvailableSlots: parkingSlot.visitorsAvailableSlots,
                regularReservedSlots: parkingSlot.RegularReservedSlots,
                regularAvailableSlots: parkingSlot.RegularAvailableSlots,
                regularTotal: regularTotal
            }
        });

    } catch (error) {
        console.error("Error updating parking slots:", error);
        res.status(500).json({
            success: false,
            type: 'error',
            message: "Failed to update parking slots. Please try again later."
        });
    }
}
