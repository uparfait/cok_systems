const { resolve_language } = require("../i18n/index.js");

/**
 * Resolves the request language from (in priority order) the
 * "X-Language" header, the "lang" query parameter, or the "Accept-Language"
 * header, defaulting to Kinyarwanda, and attaches it as req.language.
 */
function language_middleware(req, res, next) {
  const requested =
    req.headers["x-language"] ||
    req.query.lang ||
    (req.headers["accept-language"] || "").split(",")[0];

  req.language = resolve_language(requested);
  next();
}

module.exports = language_middleware;
