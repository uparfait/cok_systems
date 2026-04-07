const department_model = require('../../models/department.js')
const mongoose = require('mongoose')
const user_model = require('../../models/user.js')

module.exports = async function update_department(req, res, next) {
    try {
        const { id } = req.params
        // oly allow to change reader and response time only and sub-department status and parent department if it's a sub-department, but not allow to change department_id to avoid confusion and maintain data integrity, also not allowing to change department_name to avoid confusion but this can be changed in future if needed with proper checks for uniqueness and maybe a history log of changes
        let {

            department_response_time_in_minutes = 0,
            department_leader = null, // Expecting an email 
            department_name = null,
            department_id = null,
            sub_department_mng = null
        } = req.body || {}
            let leader_user = null

        // Validate if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `The provided ID '${id}' is not a valid format`
            })
        }

        const department = await department_model.findById(id)

        if (!department) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Department not found"
            })
        }


        // Verify and load user data if a new leader email was provided
        if (department_leader !== null && department_leader !== undefined) {
             leader_user = await user_model.findOne({ email: department_leader })
            
            if (!leader_user) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: `User with email ${department_leader} not found. Cannot assign leader.`
                })
            }

            department.department_leader = leader_user._id 
        } else {
            // decrement total employees in the current leader's department if leader is being removed and they have a department assigned
            if(department.department_leader) {
                const current_leader = await user_model.findById(department.department_leader)
                if(current_leader) {
                    const dept = department
                    if(dept) {
                        dept.number_of_employees = Math.max(0, (dept.number_of_employees || 1) - 1)
                        await dept.save()
                    }

                    // check if it is a sub_deparment and have a different parent department and decrement employee in that parent department as well
                    if(department.sub_department_mng && department.sub_department_mng.is_sub_department && department.sub_department_mng.parent_department_id && department.sub_department_mng.parent_department_id !== department._id.toString()) {
                        const parentDept = await department_model.findById(department.sub_department_mng.parent_department_id)
                        if(parentDept) {
                            parentDept.number_of_employees = Math.max(0, (parentDept.number_of_employees || 1) - 1)
                            await parentDept.save()
                        }
                    }
                }
            }
        }

        // check if department_name or department_id is being updated and if they are unique and not used by other department
        if (department_name || department_id) {
            const existing_dept = await department_model.findOne({
                $or: [
                    department_name ? { department_name: department_name } : null,
                    department_id ? { department_id: department_id.toString().toUpperCase() } : null
                ].filter(Boolean), // Remove null values
                _id: { $ne: id } // Exclude the current department from the search
            })

            if (existing_dept) {
                return res.status(409).json({
                    success: false,
                    type: "warning",
                    message: `Department with this name or ID already exists.`
                })
            }
        }

        // check if sub-department status or parent department is being updated and if it's valid
        if (sub_department_mng) {
            if (sub_department_mng.is_sub_department) {
                // Perform validation for sub-department updates
                if (!sub_department_mng.parent_department_id) {
                    return res.status(400).json({
                        success: false,
                        type: "warning",
                        message: "Parent department ID is required for sub-departments."
                    })
                }
                const parent_department = await department_model.findById(sub_department_mng.parent_department_id)
                if (!parent_department) {
                    return res.status(404).json({
                        success: false,
                        type: "warning",
                        message: "Parent department not found."
                    })
                }
                // convert parentit to string to don't save it as an Object for later comparing
                sub_department_mng.parent_department_id = parent_department._id.toString()
            }
        }


        department.department_response_time_in_minutes = department_response_time_in_minutes
        if(department_name) department.department_name = department_name
        if(department_id) department.department_id = department_id
        if(sub_department_mng) department.sub_department_mng = sub_department_mng

        const saved_department = await department.save()
        const saved_dpt_data = await department_model.findById(saved_department._id).populate('department_leader', 'full_name email title picture')

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Department updated",
            data: saved_dpt_data
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