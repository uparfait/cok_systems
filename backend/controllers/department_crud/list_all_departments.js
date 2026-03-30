const department_model = require('../../models/department.js')

module.exports = async function list_all_departments(req, res, next) {
    try {
        let { limit = 10, page = 1 } = req.query || {}

        limit = Math.min(limit, 50)

        const limit_val = parseInt(limit)
        const skip_val = (parseInt(page) - 1) * limit_val

        const departments = await department_model.find()
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 }).populate('department_leader', 'full_name email title picture')

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