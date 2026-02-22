const department_model = require('../../models/department.js');

module.exports = async function search_departments(req, res, next) {
    try {
        let { query = '', limit = 10, page = 1 } = req.query || {};

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Escape regex special characters to prevent injection
        const safe_query = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(safe_query, 'i'); // case-insensitive

        const search_criteria = {
            $or: [
                { department_name: regex },
                { department_id: regex }
            ]
        };

        const departments = await department_model.find(search_criteria)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ department_name: 1 }); // alphabetical order

        const total_count = await department_model.countDocuments(search_criteria);

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Department search results",
            total: total_count,
            page: parseInt(page),
            data: departments
        });

    } catch (error) {
        console.error("Error in search_departments:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while searching departments",
            error: error.message
        });
    }
};
