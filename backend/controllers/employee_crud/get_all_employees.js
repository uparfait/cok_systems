const user_model = require('../../models/user.js')

module.exports = async function get_employees(req, res, next) {
    try {
        let { limit = 10, page = 1 } = req.query

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        // Fetch users while explicitly excluding sensitive fields
        const employees = await user_model.find()
            .select('-password -auth') 
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 })

        const total_count = await user_model.countDocuments()

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Employees",
            total: total_count,
            page: parseInt(page),
            data: employees
        })

    } catch (error) {
        console.error("Error in get_employees:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong, while retrieving employees try again later",
            error: error.message
        })
    }
}