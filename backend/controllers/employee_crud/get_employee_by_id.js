const mongoose = require('mongoose')
const user_model = require('../../models/user.js')

module.exports = async function get_employee_by_id(req, res, next) {
    try {
        const { id } = req.params

        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid Employee ID format"
            })
        }

        const employee = await user_model.findById(id).select('-twofa_setup -password -auth -twofa_secret').populate('department', 'department_name department_id')

        if (!employee) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Employee not found"
            })
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Employee details",
            data: employee
        })

    } catch (error) {
        console.error("Error in get_employee_by_id:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong, while geting employee by id try again later"
        })
    }
}