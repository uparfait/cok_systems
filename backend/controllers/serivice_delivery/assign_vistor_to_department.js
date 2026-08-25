const ServiceDelivery = require("../../models/service_delivery.js");
const ServiceTracking = require("../../models/service_tracking.js");
const Department = require("../../models/department.js");
const mongoose = require("mongoose");
const { notifyUsers, getDepartmentRecipients } = require("../../utilities/notify.js");

/**
 * Build the live queue of the department: every visitor still in the house
 * whose current assignment is this department, ordered by assignment time.
 */
async function buildDepartmentQueue(departmentId) {
  const visitors = await ServiceDelivery.find({
    is_still_inhouse: true,
    "departments_assigned.0.department_id": String(departmentId),
  })
    .select("full_name is_being_served departments_assigned")
    .lean();

  const sorted = visitors.sort((a, b) => {
    const timeA = new Date(a.departments_assigned?.[0]?.assigned_time || 0).getTime();
    const timeB = new Date(b.departments_assigned?.[0]?.assigned_time || 0).getTime();
    return timeA - timeB;
  });

  const queue = sorted.map((v, index) => ({
    position: index + 1,
    visitor_name: v.full_name || "Unknown visitor",
    status: v.is_being_served ? "Being served" : "Waiting",
    assigned_at: v.departments_assigned?.[0]?.assigned_time || null,
  }));

  return {
    queue,
    assigned_total: queue.length,
    waiting_total: queue.filter((q) => q.status === "Waiting").length,
  };
}

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
    if (true) {
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
      0,0,
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

    visitor.services_status.splice(0,0, {
      department_id: new_department_id,
      department_name: new_department_name,
      provider_name,
      provider_id,
      s_type: "Not started",
    });

    visitor.is_being_served = false;
    const updated_visitor = await visitor.save();

    // Notify only the people the assignment belongs to:
    // - a specific employee: only that employee
    // - a unit: only the users of that unit
    // - a department: all users of that department and its units
    // Offline recipients receive a web push instead of a socket message.
    try {
      const recipients = await getDepartmentRecipients(new_department_id, provider_id);
      if (recipients.length > 0) {
        const { queue, assigned_total, waiting_total } = await buildDepartmentQueue(new_department_id);
        const targetText = provider_id
          ? "assigned to you"
          : `assigned to your ${_department.is_unit ? "unit" : "department"} ${new_department_name}`;

        await notifyUsers({
          event: "visitor_assigned",
          to: recipients,
          type: "info",
          title: "New visitor assigned",
          message: `Visitor ${visitor.full_name || "Unknown"} was ${targetText}. You now have ${assigned_total} assigned visitor${assigned_total === 1 ? "" : "s"} and ${waiting_total} waiting.`,
          data: {
            visitor_id: String(visitor._id),
            visitor_name: visitor.full_name || "",
            department_id: String(new_department_id),
            department_name: new_department_name,
            provider_id: provider_id ? String(provider_id) : null,
            assigned_total,
            waiting_total,
            queue,
          },
          url: "/",
        });
      }
    } catch (notifyError) {
      console.error("Failed to notify assignment recipients:", notifyError.message);
    }

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
