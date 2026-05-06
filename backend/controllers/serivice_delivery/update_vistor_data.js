const ServiceDelivery = require('../../models/service_delivery.js')
const ParkingRecord = require('../../models/parking_record.js')

module.exports = async function visitor_update(req, res, next) {
    try {
        const { id } = req.params
        const updates = req.body || {}

        // 1. Find existing visitor first (Prevent Blind Write)
        const existing_visitor = await ServiceDelivery.findById(id)

        if (!existing_visitor) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: "Visitor record not found"
            })
        }

        // 2. Build the update object (Only include fields present in req.body)
        // This prevents overwriting existing data with 'null' if missing in request
        let updateData = {}
        const allowedFields = [
            'full_name',
            'telephone',
            'email',
            'identification', // Optional
            'gender',
            'vehicle_storage',
            'badge_number'
        ]

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field]
            }
        })

        // 3. Handle Vehicle Logic if vehicle details are being updated
        if (updates.vehicle_storage?.vehicle_details?.plate_number) {
            let plate = updates.vehicle_storage.vehicle_details.plate_number
                .toString().toUpperCase().replace(/\s+/g, '')
            
            // Update plate in the local update object
            updateData['vehicle_storage.vehicle_details.plate_number'] = plate
            updateData['vehicle_storage.has_vehicle'] = true

            // Sync with ParkingRecord if active
            const active_parking = await ParkingRecord.findOne({ plate_number: plate, status: 'active' })
            if (active_parking) {
                // Update parking record with new visitor info if it changed
                active_parking.driver_name = updates.full_name || existing_visitor.full_name
                active_parking.driver_telephone = updates.telephone || existing_visitor.telephone
                await active_parking.save()
                
                updateData['vehicle_storage.vehicle_details.entered_time'] = active_parking.check_in
            }
        }

        // 4. Execute Update using $set to only touch specified fields
        const updated_visitor = await ServiceDelivery.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true } // Returns the modified document
        )

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Visitor information updated successfully",
            data: updated_visitor
        })

    } catch (error) {
        console.error("Error in visitor_update:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while updating visitor",
            error: error.message
        })
    }
}
