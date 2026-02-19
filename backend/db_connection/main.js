const mongoose = require("mongoose");


/*

 By default, Node.js often uses Operating System’s DNS settings, which might be pointing to a local router
  (like 192.168.1.1) or a limited ISP resolver that doesn't support SRV records properly.

  Then we have to tell Node.js to ignore the local/system settings and use Google (8.8.8.8) or Cloudflare (1.1.1.1) instead. 
  These are high-performance public servers guaranteed to handle the complex SRV and TXT records MongoDB Atlas requires.

  We do this by defollowing lines of codes 
*/
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);



// Configuration constants
const conne_user = process.env.conne_user || 'cok_systems';
const conne_password = process.env.conne_password || 'kigalicity';
const conne_app_name = process.env.conne_app_name || 'cok_systems';
const dev_mode_conne_string = `mongodb+srv://${conne_user}:${conne_password}@coksystems.rldhlb3.mongodb.net/?appName=coksystems`;
const conne_string = process.env.conne_string || dev_mode_conne_string;

/**
 * Connects to MongoDB and returns a response object
 */

const connect_db = async () => {
    try {
        const conn = await mongoose.connect(conne_string);

        return {
            status: true,
            message: "successfully connected to database",
            connection: conn.connection,
            host: conn.connection.host,
            db_name: conn.connection.name,
        };
    } catch (error) {
        return {
            status: false,
            message: "database connection failed",
            error: error,
            connection: null,
            conne_string: conne_string
        };
    }
};
const passwordReset = require('./password-reset/routes.js');
Router.use('/password-reset', passwordReset);


module.exports = connect_db;