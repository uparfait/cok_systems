const ServiceDelivery = require("../../models/service_delivery.js");
const Department = require("../../models/department.js");

module.exports = async function dashboard_visitors(req, res, next) {
  try {
    let { limit = 20, page = 1, q, in_house, history } = req.query || {};

    let user_role_name = req.user?.role_name;
    let user_department_id = req.user?.department?._id?.toString() || null;
    let user_department_unit_id = req.user?.department_unit?.toString() || null;

    const limit_val = Math.min(parseInt(limit), 20);
    const skip_val = (parseInt(page) - 1) * limit_val;

    let filter = {};
   
    if (in_house === true ||in_house === 'true') {
      filter.is_still_inhouse = true;
    }

    if (user_role_name === "Employee") {
      let departmentIds = [];
      if (user_department_id) departmentIds.push(user_department_id);
      if (user_department_unit_id) departmentIds.push(user_department_unit_id);
      if (departmentIds.length > 0) {
        filter["departments_assigned"] = {
          $elemMatch: { department_id: { $in: departmentIds } },
        };
      } else {
        return res.status(200).json({
          success: true,
          type: "success",
          message: "Dashboard visitors results",
          total: 0,
          page: parseInt(page),
          data: [],
        });
      }
    }

    if (user_role_name === "Head of department") {
      const department = await Department.findOne({
        department_leader: req.user.id,
      });

      if (!department) {
        return res.status(403).json({
          success: false,
          type: "error",
          message: "You are not assigned as a leader of any department",
        });
      }

      let department_ids = [];
      if (department.sub_department_mng?.is_sub_department) {
        department_ids = [department._id.toString()];
      } else {
        const sub_departments = await Department.find({
          "sub_department_mng.parent_department_id": department._id.toString(),
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

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { full_name: regex },
        { telephone: regex },
        { email: regex },
        { badge_number: regex },
        { "identification.number": regex },
        { "departments_assigned.department_name": regex },
        { "departments_assigned.provider_name": regex }
      ];
    }

    const visitors = await ServiceDelivery.find(filter)
      .limit(limit_val)
      .skip(skip_val)
      .sort({ entry_date: -1 });

    const total_count = await ServiceDelivery.countDocuments(filter);

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

        if (hours > 0) {
          visitorObj.current_duration = `${hours}h ${minutes}m`;
        } else {
          visitorObj.current_duration = `${minutes} mins`;
        }
        visitorObj.current_duration_hours = hours + minutes / 60;

        const hoursInside = hours + minutes / 60;
        visitorObj.is_near_limit = hoursInside >= 7;
        visitorObj.is_over_limit = hoursInside >= 8;
      } else if (
        visitor.vehicle_storage?.has_vehicle &&
        visitor.vehicle_storage?.vehicle_details?.duration
      ) {
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
      message: "Dashboard visitors results",
      total: total_count,
      page: parseInt(page),
      data: visitorsWithDuration,
    });
  } catch (error) {
    console.error("Error in dashboard_visitors:", error);
    return res.status(500).json({
      success: false,
      type: "error",
      message: "Something went wrong while retrieving dashboard visitors",
      error: error.message,
    });
  }
};
