const users_model = require("../../models/users_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Checks whether an email belongs to a user of the main system before that
 * person can be added as an individual grant - unknown emails are rejected
 * so access is only ever given to real accounts.
 */
async function check_access_email(req, res) {
  try {
    const { email } = req.body || {};

    if (!email || !email.toString().trim()) {
      return res.status(400).json(warning_response(req, "USER_EMAIL_REQUIRED"));
    }

    const user = await users_model.find_user_by_email(email);
    if (!user) {
      return res.status(404).json(warning_response(req, "USER_EMAIL_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "USER_EMAIL_FOUND", user));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = check_access_email;
