const { warning_response, error_response } = require("../utilities/response.js");

/**
 * Standard 404 handler for any request that does not match a defined route.
 */
function not_found_handler(req, res) {
  res.status(404).json(warning_response(req, "ROUTE_NOT_FOUND"));
}

/**
 * Centralized error handler, always returns a translated message body.
 */
function global_error_handler(err, req, res, next) {
  const status_code = err.status_code || err.status || err.statusCode || 500;
  res.status(status_code).json(error_response(req, "SERVER_ERROR", null, err.message));
}

module.exports = {
  not_found_handler,
  global_error_handler,
};
