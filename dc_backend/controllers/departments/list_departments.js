const departments_model = require("../../models/departments_model.js");
const { success_response, error_response } = require("../../utilities/response.js");

/**
 * Lists top-level departments read-only from the main system, used by the
 * project details form's department selector.
 */
async function list_departments(req, res) {
  try {
    const departments = await departments_model.list_departments();
    return res.status(200).json(success_response(req, "DEPARTMENTS_FETCHED", departments));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = list_departments;
