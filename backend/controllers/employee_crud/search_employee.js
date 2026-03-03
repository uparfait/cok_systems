const user_model = require('../../models/user.js')

module.exports = async function search_employees(req, res, next) {
    try {
        let { query = '', limit = 10, page = 1 } = req.query || {}

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        // Escape regex special characters to prevent injection
        const safe_query = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(safe_query, 'i') // case-insensitive

        const search_criteria = {
            $or: [
                { full_name: regex },
                { telephone: regex },
                { email: regex },
                { title: regex }
            ]
        }

        const employees = await user_model.find(search_criteria)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ full_name: 1 }).populate('department', 'department_name department_id')

        const total_count = await user_model.countDocuments(search_criteria)

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Employee search results",
            total: total_count,
            page: parseInt(page),
            data: employees
        })

    } catch (error) {
        console.error("Error in search_employees:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while searching employees",
            error: error.message
        })
    }
}
