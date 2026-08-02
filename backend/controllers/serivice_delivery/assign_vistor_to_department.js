const ServiceDelivery = require("../../models/service_delivery.js");
const ServiceTracking = require("../../models/service_tracking.js");
const Department = require("../../models/department.js");
const mongoose = require("mongoose");

module.exports = async function assign_visitor_to_department(req, res, next) {
  try {
    let {
      visitor_id = null,
      new_department_id = null,
      new_department_name = null,
      provider_name = "Not specified",
      provider_id = null,
      previous_department_id = null,
    } = req.body || {};

    if (!visitor_id || !new_department_id || !new_department_name) {
      return res.status(400).json({
        success: false,
        type: "warning",
        message:
          "Visitor ID, New Department ID, and New Department Name are required",
      });
    }

    // check if new department id is of mongodb allowed format

    if (!mongoose.Types.ObjectId.isValid(new_department_id)) {
      return res.status(400).json({
        success: false,
        type: "warning",
        message: "Invalid department id",
      });
    }

    // check if department exists and have employees

    const _department = await Department.findById(new_department_id);
    console.log(_department);

    if (!_department) {
      return res.status(404).json({
        success: false,
        type: "warning",
        message: "Department not found",
      });
    }

    if (_department.total_employees == 0) {
      return res.status(400).json({
        success: false,
        type: "warning",
        message: "There is no any employee in this department",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(visitor_id)) {
      return res
        .status(400)
        .json({
          success: false,
          type: "warning",
          message: "Invalid Visitor ID",
        });
    }

    const visitor = await ServiceDelivery.findById(visitor_id);

    if (!visitor || !visitor.is_still_inhouse) {
      return res
        .status(404)
        .json({
          success: false,
          type: "warning",
          message: "Visitor not found or has already left.",
        });
    }

    const current_time = new Date();

    // deny transfer if the visitor is still being served in the previous department
    if (previous_department_id) {
      const active_service_index = visitor.services_status.findIndex(
        (s) => s.s_type === "Inprogress",
      );

      if (active_service_index !== -1) {


        return res.status(400).json({
          success: false,
          type: "warning",
          message: "Visitor is still being served in the previous department. Please complete the service before transferring.",
        });
      }
    }

    // first of all empty department assigned to the visitor to avoid any conflict with the new department assignment

    visitor.departments_assigned.splice(
      0,
      visitor.departments_assigned.length,
      {
        department_id: new_department_id,
        department_name: new_department_name,
        assigned_time: current_time,
        provider_name,
        provider_id,
        reached_in: false,
        assigned_by: {
          user_id: req.user?.id || req.user?._id || null,
          name: req.user?.name || req.user?.full_name || 'System',
          email: req.user?.email || ''
        }
      },
    );

    visitor.services_status.splice(0, visitor.services_status.length, {
      department_id: new_department_id,
      department_name: new_department_name,
      provider_name,
      provider_id,
      s_type: "Not started",
    });

    global.WebsocketIO?.emit("new_visitor_assigned", {
      show_notif: true,
      type: "info",
      message: "You have assigned a new visitor",
    });

    global.WebsocketIO?.emit("new_visitor_assigned_to_your_department", {
      show_notif: true,
      type: "info",
      message: `Your department assigned a new visitor`,
    });
    visitor.is_being_served = false;
    const updated_visitor = await visitor.save();

    return res.status(200).json({
      success: true,
      type: "success",
      message: "Visitor successfully assigned to new department",
      data: updated_visitor,
    });
  } catch (error) {
    console.error("Error in assign_visitor:", error);
    return res
      .status(500)
      .json({
        success: false,
        type: "error",
        message: "Failed to assign visitor",
        error: error.message,
      });
  }
};
