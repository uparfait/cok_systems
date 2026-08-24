const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env"), quiet: true });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");

const config = require("./configurations/config.js");
const swagger_spec = require("./configurations/swaggerConfig.js");
const connect_databases = require("./db_connection/main.js");
const { ensure_submission_indexes } = require("./models/submissions_model.js");
const language_middleware = require("./middlewares/language.js");
const { not_found_handler, global_error_handler } = require("./middlewares/error_handler.js");
const dcs_routes = require("./routes/main.js");



const app = express();
const PORT = config.port;

app.use(
  cors({
    origin: config.client_url_set,
    credentials: true,
  }),
);

app.use(express.json({ limit: config.max_request_body_size }));
app.use(express.urlencoded({ extended: true, limit: config.max_request_body_size }));
app.use(cookieParser());
app.use(language_middleware);

app.use("/dcs/api/uploads", express.static(path.join(__dirname, config.upload_dir)));
app.use("/dcs/api/docs", swaggerUi.serve, swaggerUi.setup(swagger_spec));
app.use("/dcs/api", dcs_routes);

app.use(not_found_handler);
app.use(global_error_handler);

connect_databases()
  .then(async (result) => {
    if (!result.status) {
      console.error("Database connection failed:", result.error);
      return;
    }
    await ensure_submission_indexes();
    app.listen(PORT, () => {
      console.log("Server is running on port " + PORT);
    });
  }).catch((error) => {
    console.error("Error connecting to databases:", error);
  }
  );
