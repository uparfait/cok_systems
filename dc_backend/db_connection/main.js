const { MongoClient } = require("mongodb");
const config = require("../configurations/config.js");
const { set_db_handles } = require("./db.js");
require("dotenv").config({ quiet: true });

/**
 * Connects a single MongoClient to the shared Mongo cluster and exposes two
 * database handles off it: the primary "data_collection_system" database
 * (read/write, this system owns it) and a read-only handle into the main
 * "cok" database (departments and users only).
 */
async function connect_databases() {
  try {
    const client = new MongoClient(config.connection_string);
    console.log(config.connection_string)
    await client.connect();

    console.log(process.env)

    const primary_db = client.db();
    const cok_db = client.db(config.cok_database_name);

    set_db_handles(primary_db, cok_db);

    return { status: true, client };
  } catch (error) {
    return { status: false, error: error.message };
  }
}

module.exports = connect_databases;
