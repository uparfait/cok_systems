const departments_model = require("../../models/departments_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Lists the units belonging to a department, fetched only once a
 * department has been selected.
 */
async function list_department_units(req, res) {
  try {
    const { department_id } = req.params;

    if (!is_valid_object_id(department_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const units = await departments_model.list_department_units(department_id);
    return res.status(200).json(success_response(req, "DEPARTMENT_UNITS_FETCHED", units));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = list_department_units;
