const department_model = require('../../models/department.js')

module.exports = async function delete_department(req, res, next) {
    try {
        const { id } = req.params

        // Delete using the MongoDB internal _id
        const deleted_dept = await department_model.findByIdAndDelete(id)

        if (!deleted_dept) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Department not found"
            })
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Department deleted"
        })

    } catch (error) {
        console.error("Error in delete_department:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong during deletion",
            error: error.message
        })
    }
}