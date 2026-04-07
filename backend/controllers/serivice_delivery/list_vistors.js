const ServiceDelivery = require("../../models/service_delivery.js");
const Department = require("../../models/department.js");

module.exports = async function list_visitors(req, res, next) {
  try {
    let { in_house = true, limit = 10, page = 1 } = req.query || {};

    let user_role_name = req.user?.role_name;
    let user_department_id = req.user?.department?._id.toString() || null;
    let user_department_unit_id = req.user?.department_unit?.toString() || null;
    //let filter_role_names = ['Employee', 'Head of department']

    const limit_val = Math.min(parseInt(limit), 50);
    const skip_val = (parseInt(page) - 1) * limit_val;

    let filter = {};
    if (in_house === "true" || in_house === true)
      filter.is_still_inhouse = true;
    if (in_house === "false" || in_house === false)
      filter.is_still_inhouse = false;

    // if user role is employee check  if has department unit and only fetch visitors of that department unit
    // if not has a department unit fetch the one in department
    // If department is a unit, also include visitors assigned to parent department

    if (user_role_name === "Employee") {
      let departmentIds = [];
      if (user_department_unit_id) {
        departmentIds.push(user_department_unit_id);
        // Find parent department
        const unitDept = await Department.findById(user_department_unit_id);
        if (unitDept && unitDept.sub_department_mng?.is_sub_department) {
          const parentDept = await Department.findOne({
            department_id: unitDept.sub_department_mng.parent_department_id,
          });
          if (parentDept) {
            departmentIds.push(parentDept._id.toString());
          }
        }
      } else if (user_department_id) {
        departmentIds.push(user_department_id);
      }
      if (departmentIds.length > 0) {
        filter["departments_assigned"] = {
          $elemMatch: { department_id: { $in: departmentIds } },
        };
      }
    }

    // check if user is head of department and get the department id and sub department ids and fetch the visitors of those departments
    if (user_role_name === "Head of department") {
      // find the department where the user is the leader
      const department = await Department.findOne({
        department_leader: req.user._id,
      });
      // check if is sub department and find its children
      if (!department) {
        return res.status(403).json({
          success: false,
          type: "error",
          message: "You are not assigned as a leader of any department",
        });
      }

      let department_ids = [];
      if (department.sub_department_mng?.is_sub_department) {
        // find the parent department
        const parent_department = await Department.findOne({
          department_id: department.sub_department_mng.parent_department_id,
        });
        if (parent_department) {
          // find the sub departments of the parent department.
          const sub_departments = await Department.find({
            "sub_department_mng.parent_department_id":
              parent_department.department_id,
          });
          department_ids = [
            parent_department._id.toString(),
            ...sub_departments.map((dep) => dep._id.toString()),
          ];
        } else {
          department_ids = [department._id.toString()];
        }
      } else {
        // Not a sub department, find its sub departments and include them
        const sub_departments = await Department.find({
          "sub_department_mng.parent_department_id": department.department_id,
        });
        department_ids = [
          department._id.toString(),
          ...sub_departments.map((dep) => dep._id.toString()),
        ];
      }

      filter["departments_assigned"] = {
        $elemMatch: { department_id: { $in: department_ids } },
      };
    }

    const visitors = await ServiceDelivery.find(filter)
      .limit(limit_val)
      .skip(skip_val)
      .sort({ entry_date: -1 });

    const total_count = await ServiceDelivery.countDocuments(filter);

    // Calculate current duration for in-house visitors
    const visitorsWithDuration = visitors.map((visitor) => {
      const visitorObj = visitor.toObject();
      if (visitor.is_still_inhouse && visitor.entry_date) {
        const entryTime = new Date(visitor.entry_date);
        const currentTime = new Date();
        const durationMs = currentTime - entryTime;
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor(
          (durationMs % (1000 * 60 * 60)) / (1000 * 60),
        );

        // Calculate duration in different formats
        if (hours > 0) {
          visitorObj.current_duration = `${hours}h ${minutes}m`;
        } else {
          visitorObj.current_duration = `${minutes} mins`;
        }
        visitorObj.current_duration_hours = hours + minutes / 60;

        // Check if approaching 8 hour limit
        const hoursInside = hours + minutes / 60;
        visitorObj.is_near_limit = hoursInside >= 7; // 7 hours = near 8 hour limit
        visitorObj.is_over_limit = hoursInside >= 8;
      } else if (
        visitor.vehicle_storage?.has_vehicle &&
        visitor.vehicle_storage?.vehicle_details?.duration
      ) {
        // Use stored duration for checked out visitors
        visitorObj.current_duration =
          visitor.vehicle_storage.vehicle_details.duration;
        visitorObj.current_duration_hours =
          parseFloat(visitor.vehicle_storage.vehicle_details.duration) / 60 ||
          0;
      } else {
        visitorObj.current_duration = "N/A";
        visitorObj.current_duration_hours = 0;
      }
      return visitorObj;
    });

    return res.status(200).json({
      success: true,
      type: "success",
      message: "Visitors results",
      total: total_count,
      page: parseInt(page),
      data: visitorsWithDuration,
    });
  } catch (error) {
    console.error("Error in list_visitors:", error);
    return res.status(500).json({
      success: false,
      type: "error",
      message: "Something went wrong while retrieving visitors",
      error: error.message,
    });
  }
};
