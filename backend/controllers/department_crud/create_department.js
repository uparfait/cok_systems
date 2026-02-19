const department_model = require('../../models/department.js')

module.exports = async function create_department(req, res, next) {
    try {
        let {
            department_name = null,
            department_id = null,
            department_leader = 'Not specified',
            total_employees = 0,
        } = req.body || {}

        //  department validation
        if (!department_name || !department_id) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "department name and id are required"
            })
        }

        //  Check if department already exists
        const existing_dept = await department_model.findOne({ department_id })
        if (existing_dept) {
            return res.status(409).json({
                success: false,
                status: 'warning',
                message: `Department with ID ${department_id} already exists.`
            })
        }

        let registered_by = req.user || "Not specified"

        //  Create new department instance
        const new_department = new department_model({
            department_name,
            department_id,
            department_leader,
            total_employees,
            registered_by
        })

        //  Save to database
        const saved_department = await new_department.save()

        return res.status(201).json({
            success: true,
            type: "success",
            message: "Department created successfully",
            data: {
                department_name,
                department_id,
                department_leader,
                total_employees,
                registered_by
            }
        })

    } catch (error) {
        console.error("Error in create_department controller:", error)

        // Pass to global error handler
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something got wrong try again later",
            error: error.message
        })
    }
}