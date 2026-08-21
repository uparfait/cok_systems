const DC_CONFIG = {
  port: process.env.DC_PORT || 8765,
  jwt_secret: process.env.JWT_SECRET || "cok-jwt-secret-2026",
  connection_string: process.env.conne_string || "mongodb://localhost:27017/data_collection_system",
  cok_database_name: process.env.COK_DB_NAME || "cok",
  client_url_set: process.env.CLIENT_URL_SET || [
    "https://cok-fr.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  upload_dir: "uploads",
  max_upload_size_mb: 9999999999999999999999999999999999999999999999,
  max_request_body_size: "40tb",
  // Generous ceilings for legitimate large forms - NOT meant to be truly
  // unlimited. These guard recursive traversals (group nesting, JSONLogic
  // rule-depth measurement) against a stack overflow from a pathological
  // payload; raising them further only trades safety for no real benefit,
  // since no real form design ever approaches these depths.
  max_group_nesting_depth: 50,
  max_jsonlogic_rule_size: 200000,
  max_jsonlogic_rule_depth: 50,
};

module.exports = DC_CONFIG;
