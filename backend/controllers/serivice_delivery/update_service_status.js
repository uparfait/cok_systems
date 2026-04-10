const ServiceDelivery = require('../../models/service_delivery.js');

module.exports = async function update_service_status(req, res, next) {
    try {

        return res.status(404).json({
            success: false,
            type: 'warning',
            message: "This endpoint is currently disabled"
        });
        const { id } = req.params;
        const { services_status, durations, notes } = req.body;

        // 1. Find existing visitor
        const existing_visitor = await ServiceDelivery.findById(id);

        if (!existing_visitor) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: "Visitor record not found"
            });
        }

        // 2. Only update the specific service and timer arrays
        let updateData = {};
        if (services_status) updateData.services_status = services_status;
        if (durations) updateData.durations = durations;
        if (notes) updateData.notes = notes;

        // 3. Save to database
        const updated_visitor = await ServiceDelivery.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Service session updated successfully",
            data: updated_visitor
        });

    } catch (error) {
        console.error("Error in update_service_status:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while updating service status",
            error: error.message
        });
    }
}