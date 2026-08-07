const department_model = require('../../models/department.js')

module.exports = async function list_all_departments(req, res, next) {
    try {
        let { limit = 1000, page = 1 } = req.query || {}

        const limit_val = parseInt(limit)
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Get MAIN departments only (exclude both new format is_unit=true AND legacy sub_department_mng.is_sub_department=true)
        const departments = await department_model.find({
            $and: [
                { is_unit: { $ne: true } },
                { $or: [
                    { 'sub_department_mng.is_sub_department': { $ne: true } },
                    { 'sub_department_mng.is_sub_department': { $exists: false } }
                ]}
            ]
        })
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_at: -1 })
            .populate('leader', 'full_name email title')
            .populate('department_leader', 'full_name email title')
            .populate('employees', 'full_name email')
            .populate('parent_department', 'department_name')

        // For each main department, fetch its SUB-DEPARTMENTS (units)
        // Supports both new format (is_unit=true + parent_department) and legacy format (sub_department_mng)
        const departmentsWithSubs = await Promise.all(
            departments.map(async (dept) => {
                const subDepartments = await department_model.find({
                    $or: [
                        // New format: is_unit flag with parent_department ObjectId reference
                        { is_unit: true, parent_department: dept._id },
                        // Legacy format: sub_department_mng structure with parent_department_id string
                        { 
                            'sub_department_mng.is_sub_department': true,
                            'sub_department_mng.parent_department_id': dept._id.toString()
                        }
                    ]
                })
                .populate('leader', 'full_name email title')
                .populate('department_leader', 'full_name email title')
                .populate('employees', 'full_name email')

                return {
                    ...dept.toObject(),
                    sub_departments: subDepartments
                }
            })
        )

        const total_count = await department_model.countDocuments({
            $and: [
                { is_unit: { $ne: true } },
                { $or: [
                    { 'sub_department_mng.is_sub_department': { $ne: true } },
                    { 'sub_department_mng.is_sub_department': { $exists: false } }
                ]}
            ]
        })

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Departments list",
            total: total_count,
            page: parseInt(page),
            data: departmentsWithSubs
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
