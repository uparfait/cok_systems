const ServiceDelivery = require("../../models/service_delivery.js");
const {
  visitFromRef, assignVisit, transferService, visitView, sendError, badRequest, notFound,
} = require("../../utilities/visitors");

/**
 * POST /servicedelivery/visitor/assign
 * Body: { visitor_id (visit id or visitor id), new_department_id, new_department_name, provider_id?, provider_name? }
 * Employees transfer (their own service and pending entries close as
 * Transfered); every other role sends the visitor to the department.
 * Refused while someone is serving the visitor.
 */
module.exports = async function assign_visitor_to_department(req, res) {
  try {
    const body = req.body || {};
    if (!body.visitor_id || !body.new_department_id) {
      throw badRequest("Visitor ID, New Department ID, and New Department Name are required");
    }
    const visit = await visitFromRef(body.visitor_id);
    if (!visit || !visit.is_still_inhouse) throw notFound("Visitor not found or has already left.");

    const named = await ServiceDelivery.findById(visit._id).populate("visitor", "full_name").lean();
    const visitorName = named && named.visitor ? named.visitor.full_name : "";
    const target = {
      department_id: body.new_department_id,
      department_name: body.new_department_name || "",
      provider_id: body.provider_id || null,
      provider_name: body.provider_name || "",
    };

    const isEmployee = String((req.navigation && req.navigation.role_slug) || "") === "employee";
    if (isEmployee) await transferService(visit._id, req.user, target, { notes: body.notes || null, visitorName });
    else await assignVisit(visit, req.user, target, { visitorName });

    const fresh = await ServiceDelivery.findById(visit._id).populate("visitor").lean();
    return res.status(200).json({
      success: true,
      type: "success",
      message: "Visitor successfully assigned to new department",
      data: visitView(fresh),
    });
  } catch (error) {
    return sendError(res, error, "Failed to assign visitor");
  }
};
