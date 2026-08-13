const jwt = require("jsonwebtoken");
const config = require("../configurations/config.js");

/**
 * Verifies an access token minted by the main backend's login flow.
 * dc_backend never issues tokens of its own, it only verifies them, so the
 * same JWT_SECRET must be configured on both services.
 */
function verify_access_token(token) {
  try {
    return { valid: true, decoded: jwt.verify(token, config.jwt_secret) };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Extracts the raw token from an "Authorization: Bearer <token>" header.
 */
function extract_token(auth_header) {
  if (!auth_header) return null;
  const parts = auth_header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

module.exports = {
  verify_access_token,
  extract_token,
};
