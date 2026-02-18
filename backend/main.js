const db_connection = require("./db_connection/main");

db_connection().then((response) => {
    console.log(response);
    if (response.status) {
        console.log(response.message);
        console.log(`Connected to database: ${response.db_name} at host: ${response.host}`);
    } else {
        console.error(response.message);
        console.error(`Error details: ${response.error_details}`);
    }
}).catch((error) => {
    console.error("An unexpected error occurred while connecting to the database.");
    console.error(`Error details: ${error.message}`);
});