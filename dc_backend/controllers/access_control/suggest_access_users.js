const users_model = require("../../models/users_model.js");
const { success_response, error_response } = require("../../utilities/response.js");

// Suggests existing accounts matching the typed name or email so individuals can be picked instead of typed in full.
async function suggest_access_users(req, res) {
  try {
    const query = (req.query.query || "").toString().trim();

    // Fewer than two characters would match nearly everyone.
    if (query.length < 2) {
      return res.status(200).json(success_response(req, "USER_SUGGESTIONS_FETCHED", []));
    }

    const users = await users_model.search_users(query, 8);
    return res.status(200).json(success_response(req, "USER_SUGGESTIONS_FETCHED", users));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = suggest_access_users;
