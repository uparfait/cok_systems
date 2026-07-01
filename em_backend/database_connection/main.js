const mongoose = require("mongoose");


/*

 By default, Node.js often uses Operating System’s DNS settings, which might be pointing to a local router
  (like 192.168.1.1) or a limited ISP resolver that doesn't support SRV records properly.

  Then we have to tell Node.js to ignore the local/system settings and use Google (8.8.8.8) or Cloudflare (1.1.1.1) instead. 
  These are high-performance public servers guaranteed to handle the complex SRV and TXT records MongoDB Atlas requires.

  We do this by the following lines of codes 
*/
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);


const config = require('../configurations/config');




/**
 * Connects to MongoDB and returns a response object
 */

const connect_db = async () => {
    try {
        const conn = await mongoose.connect(config.database.url);

        return {
            status: true,
            message: "Successfully Connected to Database",
            connection: conn.connection,
            host: conn.connection.host,
            db_name: conn.connection.name,
        };
    } catch (error) {
        return {
            status: false,
            message: "Database Connection Failed",
            error: error,
            connection: null,
            connection_string: config.database.url
        };
    }
};

module.exports = connect_db;