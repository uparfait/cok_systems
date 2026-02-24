const department_model = require('../../models/department.js')
const user_model = require('../../models/user.js') // Added user model

module.exports = async function create_department(req, res, next) {
    try {

        // 
        let {
            department_name = null,
            department_id = null,
            department_leader = null, // Expecting an email string here
            department_response_time_in_minutes = 0
        } = req.body || {}
        let leader_user = null

        // department validation
        if (!department_name || !department_id) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "department name and id are required"
            })
        }

        department_id = department_id.toString().toUpperCase()

        // Check if department already exists
        const existing_dept = await department_model.findOne({ department_id })
        if (existing_dept) {
            return res.status(409).json({
                success: false,
                type: 'warning', // user's schema previously used status: 'warning', matching type here
                message: `Department with ID ${department_id} already exists.`
            })
        }

        // Verify and load user data if a leader email was provided
        let leader_data = null
        if (department_leader && department_leader !== 'Not specified') {
            leader_user = await user_model.findOne({ email: department_leader })
            
            if (!leader_user) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: `User with email ${department_leader} not found. Cannot assign leader.`
                })
            }

            // Map the user's data to the new leader object structure
            leader_data = {
                name: leader_user?.full_name,
                email: leader_user?.email,
                title: leader_user?.title || "",
                picture: leader_user?.picture || ""
            }
        }

        let registered_by = req.user?.name || "Not specified"

        // Create new department instance
        const new_department = new department_model({
            department_name,
            department_id,
            department_leader: leader_data, // Assign the newly structured object
            total_employees: leader_user?.full_name ? 1 : 0,
            department_response_time_in_minutes,
            registered_by
        })

        // Save to database
        const saved_department = await new_department.save()

        return res.status(201).json({
            success: true,
            type: "success",
            message: "Department created successfully",
            data: saved_department
        })

    } catch (error) {
        console.error("Error in create_department controller:", error)

        // Pass to global error handler
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while creating department",
            error: error.message
        })
    }
}