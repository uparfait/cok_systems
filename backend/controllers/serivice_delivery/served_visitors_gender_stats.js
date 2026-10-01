const { userIdOf, departmentScopeFor, sendError } = require("../../utilities/visitors");
const { genderSeries, boundsView } = require("./assigned_visitors_gender_stats.js");

// Custom roles named like these are heads of department too (the default
// role has the department-manager slug)
const HEAD_KEYWORDS = ["head of department", "department manager", "department head", "director"];

function isHeadOfDepartment(req) {
  const slug = String((req.navigation && req.navigation.role_slug) || "").toLowerCase();
  if (slug === "department-manager") return true;
  const roleName = String((req.user && (req.user.role_name || req.user.role)) || "").toLowerCase();
  return HEAD_KEYWORDS.some((keyword) => roleName.includes(keyword));
}

/**
 * GET /servicedelivery/served-visitors/gender-stats ?period&from&to
 * Visits by gender (the gender of the visitor each visit references).
 * Heads of department: visits sent to the departments they lead and their
 * units (plus their own department and unit). Everyone else: visits assigned
 * to them or served by them.
 */
module.exports = async function served_visitors_gender_stats(req, res) {
  try {
    const { period = "month", from, to } = req.query || {};

    let match;
    let warning = null;
    if (isHeadOfDepartment(req)) {
      const departments = await departmentScopeFor(req.user, "department-manager");
      if (departments.length) {
        match = { departments_assigned: { $elemMatch: { department_id: { $in: departments } } } };
      } else {
        // Zero counts instead of a refusal: the chart polls every few seconds
        match = null;
        warning = "No department found for this head of department";
      }
    } else {
      match = { departments_assigned: { $elemMatch: { provider_id: userIdOf(req.user) } } };
    }

    const { bounds, data, totals } = await genderSeries({ match, period, from, to });

    return res.status(200).json({
      success: true,
      type: warning ? "warning" : "success",
      message: warning || "Served visitors gender stats fetched successfully",
      data,
      totals,
      period,
      bounds: boundsView(bounds),
    });
  } catch (error) {
    return sendError(res, error, "Something went wrong while fetching served visitors gender stats");
  }
};
