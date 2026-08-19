const { get_cok_db } = require("../db_connection/db.js");

/**
 * Escapes a string so it can be used as a literal inside a regex, letting
 * emails be matched case-insensitively without partial matches.
 */
function escape_regex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds a user of the main system by email (read-only, case-insensitive).
 * Only the fields the access-control feature needs are ever exposed.
 */
async function find_user_by_email(email) {
  const normalized = (email || "").toString().trim();
  if (!normalized) return null;

  const user = await get_cok_db()
    .collection("users")
    .findOne(
      { email: { $regex: `^${escape_regex(normalized)}$`, $options: "i" } },
      { projection: { email: 1, full_name: 1 } },
    );

  if (!user) return null;
  return { user_id: user._id.toString(), email: user.email, full_name: user.full_name || "" };
}

module.exports = {
  find_user_by_email,
};
