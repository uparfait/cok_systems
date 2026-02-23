const department_model = require('../../models/department.js')
const mongoose = require('mongoose')

module.exports = async function update_department(req, res, next) {
    try {
        const { id } = req.params
        const {
            department_id = null,
            department_name = null,
            department_leader = null
        } = req.body || {}

        //  Validate if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `The provided ID '${id}' is not a valid format`
            })
        }

        // Find the document by its MongoDB internal _id
        const department = await department_model.findById(id)

        if (!department) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Department not found"
            })
        }

        if (
            department_id === null ||
            department_name === null ||
            department_leader === null
        ) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Some department data are invalid",
            })
        }

        department_id = department_id.toString().toUpperCase()

        //validate and update allowed fields
        if (department_name !== undefined) department.department_name = department_name
        if (department_leader !== undefined) department.department_leader = department_leader
        if (department_id !== undefined) department.department_id = department_id

        department.registered_by = req.user?.name || "Not specified"

        // Save the document (this triggers Mongoose validation)
        const saved_department = await department.save()

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Department updated",
        })

    } catch (error) {
        console.error("Error in update_department:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Update failed, check your data and try again",
            error: error.message
        })
    }
}