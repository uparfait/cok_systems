const user_model = require("../../models/user.js");
const Department = require("../../models/department.js");

module.exports = async function search_employees(req, res, next) {
  try {
    let { query = "", limit = 50, page = 1 } = req.query || {};

    const limit_val = Math.min(parseInt(limit), 50);
    const skip_val = (parseInt(page) - 1) * limit_val;

    // Escape regex special characters to prevent injection
    const safe_query = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe_query, "i"); // case-insensitive

    const user_role_name = req.user?.role_name;

    let filter = {};

    // so if a user is a head of department, then we will only show the employees that are in his department and department unit if he has one, if not we will show all employees
    if (user_role_name === "Head of department") {
      // fetch the department of the head of department
      const department = await Department.findOne({
        department_leader: req.user.id,
      });

      if (department) {
        // if it is not a sub department add filter to be a department id
        if (!department.sub_department_mng.is_sub_department) {
          filter.department = department._id.toString();
        } else {
          // if it is a sub department add filter to be a department unit id
          filter.department_unit = department._id.toString();
        }
      } else {
        return res.status(200).json({
          success: true,
          type: "success",
          message: "Employees list",
          total: 0,
          page: parseInt(page),
          data: [],
        });
      }
    }

    const search_criteria = {
      $and: [
        {
          $or: [
            { full_name: regex },
            { telephone: regex },
            { email: regex },
            { title: regex },
          ],
        },
        ...(user_role_name === "Head of department" ? [filter] : []),
      ],
    };

    const employees = await user_model
      .find(search_criteria)
      .select('-twofa_setup -password -auth -twofa_secret') 
      .limit(limit_val)
      .skip(skip_val)
      .sort({ full_name: 1 })
      .populate("department", "department_name department_id");

    const total_count = await user_model.countDocuments(search_criteria);

    return res.status(200).json({
      success: true,
      type: "success",
      message: "Employee search results",
      total: total_count,
      page: parseInt(page),
      data: employees,
    });
  } catch (error) {
    console.error("Error in search_employees:", error);
    return res.status(500).json({
      success: false,
      type: "error",
      message: "Something went wrong while searching employees",
      error: error.message,
    });
  }
};
