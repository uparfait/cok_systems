const department_model = require('../../models/department.js')
const user_model = require('../../models/user.js') // Added user model

module.exports = async function create_department(req, res, next) {
    try {

        // 
        let {
            department_name = null,
            department_id = null,
            sub_department_mng = {
                is_sub_department: false,
                parent_department_id: null
            },
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
        const existing_dept = await department_model.findOne({ 
            // name or id should be unique
            $or: [
                { department_name: department_name },
                { department_id: department_id }
            ]
         })
        if (existing_dept) {
            return res.status(409).json({
                success: false,
                type: 'warning', // user's schema previously used status: 'warning', matching type here
                message: `Department with this name or ID already exists.`
            })
        }

        //check if parent department exists if this is a sub-department
        if (sub_department_mng.is_sub_department) {
            // first check if it exists and mongodb valid id format
            if (!sub_department_mng.parent_department_id) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: "Parent department ID is required for sub-departments."
                })
            }
            // convert to mongodb id format and check if it exists
            const parent_department = await department_model.findById(sub_department_mng.parent_department_id)
            if (!parent_department) {
                return res.status(404).json({
                    success: false,
                    type: 'warning',
                    message: "Parent department not found."
                })
            }
            // convert parentit to string to don't save it as an Object for later comparing
            sub_department_mng.parent_department_id = parent_department._id.toString()
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

            
            leader_data = leader_user._id // Store the ObjectId reference to the User document
        }

        let registered_by = req.user?.name || "Not specified"

        // Create new department instance
        const new_department = new department_model({
            sub_department_mng,
            department_name,
            department_id,
            department_leader: leader_data,
            total_employees: leader_user?.full_name ? 1 : 0,
            department_response_time_in_minutes,
            registered_by
        })

        // Save to database
        const saved_department = await new_department.save()
        const saved_dpt_data = await department_model.findById(saved_department._id).populate('department_leader', 'full_name email title picture')

        return res.status(201).json({
            success: true,
            type: "success",
            message: "Department created successfully",
            data: saved_dpt_data
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