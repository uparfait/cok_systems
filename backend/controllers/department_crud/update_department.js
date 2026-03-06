const department_model = require('../../models/department.js')
const mongoose = require('mongoose')
const user_model = require('../../models/user.js')

module.exports = async function update_department(req, res, next) {
    try {
        const { id } = req.params
        // oly allow to change reader and response time only
        let {
            department_response_time_in_minutes = 0,
            department_leader = null, // Expecting an email 
            department_name = null,
            department_id = null,
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
        }
        department.department_response_time_in_minutes = department_response_time_in_minutes
        if(department_name) department.department_name
        if(department_id) department.department_id

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