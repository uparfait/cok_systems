const { translate } = require("../i18n/index.js");

/**
 * Builds a translated success response body.
 */
function success_response(req, message_key, data, vars) {
  return {
    success: true,
    type: "success",
    message: translate(message_key, req.language, vars),
    data: data === undefined ? null : data,
  };
}

/**
 * Builds a translated warning response body (client-side fixable error).
 */
function warning_response(req, message_key, vars, extra) {
  return Object.assign(
    {
      success: false,
      type: "warning",
      message: translate(message_key, req.language, vars),
    },
    extra || {},
  );
}

/**
 * Builds a translated hard error response body (server/unexpected error).
 */
function error_response(req, message_key, vars, error_detail) {
  return {
    success: false,
    type: "error",
    message: translate(message_key, req.language, vars),
    error: error_detail || null,
  };
}

module.exports = {
  success_response,
  warning_response,
  error_response,
};
