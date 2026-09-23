const jwt = require("../utilities/jwt.js");
const { get_cok_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");
const { warning_response, error_response } = require("../utilities/response.js");
const config = require("../configurations/config.js");
const { mongo_host } = require("../utilities/auth_check.js");

/**
 * Verifies the Bearer token issued by the main backend's login flow and
 * attaches the matching user (read-only, from the main "cok" database) to
 * req.user. dc_backend never issues or refreshes tokens itself.
 */
async function authenticate(req, res, next) {
  try {
    const auth_header = req.headers.authorization;


    if (!auth_header) {
      return res.status(401).json(warning_response(req, "AUTH_HEADER_REQUIRED", null, { goto_login: true }));
    }

    const token = jwt.extract_token(auth_header);

    if (!token) {
      return res.status(401).json(warning_response(req, "AUTH_TOKEN_MALFORMED", null, { goto_login: true }));
    }

    const verification = jwt.verify_access_token(token);
    if (!verification.valid) {
      // The reason travels with the refusal: "invalid signature" means this
      // service's JWT_SECRET differs from the main backend's, "jwt expired"
      // means the session really ended.
      const reason = verification.error === "invalid signature" ? "invalid signature: this service's JWT_SECRET differs from the main backend's" : verification.error;
      return res.status(401).json(warning_response(req, "AUTH_TOKEN_INVALID", null, { goto_login: true, error: reason }));
    }

    const user_id = to_object_id(verification.decoded.userId);
    if (!user_id) {
      return res.status(401).json(warning_response(req, "AUTH_TOKEN_INVALID", null, { goto_login: true }));
    }

    const user = await get_cok_db().collection("users").findOne({ _id: user_id });

    if (!user) {
      // Says where it looked, since a wrong Mongo server is the usual cause.
      const where = `account ${user_id} is not in database '${config.cok_database_name}' on ${mongo_host(config.connection_string)}`;
      return res.status(401).json(warning_response(req, "AUTH_USER_NOT_FOUND", null, { goto_login: true, error: where }));
    }

    if (!user.is_account_activated) {
      return res.status(403).json(warning_response(req, "AUTH_ACCOUNT_NOT_ACTIVATED"));
    }

    if (user.access_control?.is_locked) {
      return res.status(403).json(warning_response(req, "AUTH_ACCOUNT_LOCKED"));
    }

    req.user = {
      user_id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.roles?.role_name || "",
      permissions: user.roles?.permissions || [],
      department_id: user.department ? user.department.toString() : null,
    };

    next();
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = authenticate;
