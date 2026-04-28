const department_model = require('../../models/department.js')

module.exports = async function list_all_departments(req, res, next) {
    try {
        
        //  Increased default limit to 1000 so sub-departments don't hide main departments
        let { limit = 1000, page = 1 } = req.query || {}

        const user_role_name = req.user?.role_name;

        const limit_val = parseInt(limit)
        const skip_val = (parseInt(page) - 1) * limit_val;

        // so filter out the one which is the sub-department of another department and only get the main departments first, then we will loop through each main department and get their sub-departments and attach them to the main department object
        // filter where subdepartment_mng.is_sub_department is not true, because if it's true then it means it's a sub-department and we don't want to include it in the main departments list, we will get it later when we loop through each main department and get their sub-departments
        // apply below filter only if user is a head of department
        let filter = {}
        if (user_role_name === "Head of department") {
            filter = {
                'sub_department_mng.is_sub_department': { $ne: true }
            }
        };

        const departments = await department_model.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 })
            .populate('department_leader', 'full_name email title picture')

        // also loop to all and attach sub-departments for each department and populate their leaders as well
        for (let dept of departments) {
            const subDepartments = await department_model.find({ 'sub_department_mng.parent_department_id': dept._id.toString() }).populate('department_leader', 'full_name email title picture')
            dept._doc.sub_departments = subDepartments // add sub_departments field to the department object
        }

        const total_count = await department_model.countDocuments()

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Departments list",
            total: total_count,
            page: parseInt(page),
            data: departments
        })

    } catch (error) {
        console.error("Error in list_all_departments:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong, try again later",
            error: error.message
        })
    }
}