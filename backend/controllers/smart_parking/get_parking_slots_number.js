// this file allow to get parking slots

const ParkingSlot = require('../../models/parking_slots.js')

module.exports = async function get_parking_slots_number(req, res, next) {
    try {
        const parking_slots = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' });
        
        res.json({
            success: true,
            data: {
                available_slots: parking_slots || null
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