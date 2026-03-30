const department_model = require('../../models/department.js')

module.exports = async function get_department_by_id(req, res, next) {
    try {
        const { department_id } = req.params;

        department_id = department_id.toString().toUpperCase()

        // populate reader

        const department = await department_model.findOne({ department_id }).populate('department_leader', 'full_name email title picture')
        // also fetch its sub-departments if any first convert sub-department_mng.parent_department_id to String for matching with department._id which is an ObjectId
        const subDepartments = await department_model.find({ 'sub_department_mng.parent_department_id': department._id.toString() }).populate('department_leader', 'full_name email title picture')

        if (!department) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: `Department with ID ${department_id} not found.`
            })
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Department found",
            data: department,
            sub_departments: subDepartments
        })

    } catch (error) {
        console.error("Error in get_department_by_id:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong, try again later",
            error: error.message
        })
    }
}