let primary_db_handle = null;
let cok_db_handle = null;

/**
 * Stores the connected database handles so any module can read them after
 * db_connection/main.js has finished connecting.
 */
function set_db_handles(primary_db, cok_db) {
  primary_db_handle = primary_db;
  cok_db_handle = cok_db;
}

/**
 * Returns the primary "data_collection_system" database handle.
 */
function get_db() {
  if (!primary_db_handle) {
    throw new Error("Data collection database is not connected yet");
  }
  return primary_db_handle;
}

/**
 * Returns the read-only handle into the main system's "cok" database, used
 * to look up departments and users without duplicating that data.
 */
function get_cok_db() {
  if (!cok_db_handle) {
    throw new Error("Cok database is not connected yet");
  }
  return cok_db_handle;
}

module.exports = {
  set_db_handles,
  get_db,
  get_cok_db,
};
