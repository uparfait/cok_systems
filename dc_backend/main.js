const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env"), quiet: true });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");
const zlib = require("zlib");

const config = require("./configurations/config.js");
const swagger_spec = require("./configurations/swaggerConfig.js");
const connect_databases = require("./db_connection/main.js");
const { ensure_submission_indexes } = require("./models/submissions_model.js");
const { ensure_location_indexes } = require("./models/locations_model.js");
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

// Compression middleware (Brotli preferred, gzip fallback)
function compressionMiddleware(req, res, next) {
  const acceptEncoding = req.headers["accept-encoding"] || "";

  let encoding = null;

  if (acceptEncoding.includes("br")) {
    encoding = "br";
  } else if (acceptEncoding.includes("gzip")) {
    encoding = "gzip";
  }

  if (!encoding) {
    return next();
  }

  const originalWrite = res.write;
  const originalEnd = res.end;

  let chunks = [];

  res.write = function (chunk, ...args) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  };

  res.end = function (chunk, ...args) {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const originalData = Buffer.concat(chunks);

    const options = encoding === "br"
      ? { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }
      : { level: zlib.constants.Z_BEST_COMPRESSION };

    const compressed = encoding === "br"
      ? zlib.brotliCompressSync(originalData, options)
      : zlib.gzipSync(originalData, options);

    const originalSize = originalData.length;
    const compressedSize = compressed.length;
    const saved = originalSize - compressedSize;
    const percentage = originalSize ? (saved / originalSize) * 100 : 0;

    console.log("\n========== COMPRESSION ==========");
    console.log(`URL:          ${req.originalUrl}`);
    console.log(`Encoding:     ${encoding}`);
    console.log(`Before:       ${originalSize} B`);
    console.log(`After:        ${compressedSize} B`);
    console.log(`Saved:        ${saved} B`);
    console.log(`Compression:  ${percentage.toFixed(2)}%`);
    console.log("=================================\n");

    res.setHeader("Content-Encoding", encoding);
    res.setHeader("Content-Length", compressed.length);
    res.setHeader("Vary", "Accept-Encoding");

    return originalEnd.call(res, compressed);
  };

  next();
}

app.use(compressionMiddleware);

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
    await ensure_location_indexes();
    app.listen(PORT, () => {
      console.log("Server is running on port " + PORT);
    });
  }).catch((error) => {
    console.error("Error connecting to databases:", error);
  }
  );
