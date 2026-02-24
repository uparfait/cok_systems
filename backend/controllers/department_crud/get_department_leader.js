const department_model = require('../../models/department.js')

module.exports = async function get_departments_by_leader(req, res, next) {
    try {
        const { email } = req.params 

        if (!email) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Leader email is required"
            })
        }

        // Find all departments where this email matches the leader object's email
        const departments = await department_model.find({ "department_leader.email": email })

        if (!departments || departments.length === 0) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: `No departments found for leader with email ${email}`
            })
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Departments retrieved successfully",
            count: departments.length,
            data: departments
        })

    } catch (error) {
        console.error("Error in get_departments_by_leader controller:", error)

        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching the departments",
            error: error.message
        })
    }
}