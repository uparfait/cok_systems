const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, ".env"),
    quiet: true
});

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");
const zlib = require("zlib");

const config = require("./configurations/config.js");
const swagger_spec = require("./configurations/swaggerConfig.js");
const connect_databases = require("./db_connection/main.js");

const {
    ensure_submission_indexes
} = require("./models/submissions_model.js");

const {
    ensure_location_indexes
} = require("./models/locations_model.js");

const language_middleware =
    require("./middlewares/language.js");

const {
    not_found_handler,
    global_error_handler
} = require("./middlewares/error_handler.js");

const dcs_routes = require("./routes/main.js");
const locations_routes = require("./routes/locations/routes.js");


// ============================================================
// APP
// ============================================================

const app = express();

const PORT = config.port;


// ============================================================
// CORS
// ============================================================

app.use(
    cors({
        origin: config.client_url_set,
        credentials: true
    })
);


// ============================================================
// BODY PARSERS
// ============================================================

app.use(
    express.json({
        limit: config.max_request_body_size
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: config.max_request_body_size
    })
);


// ============================================================
// COOKIES
// ============================================================

app.use(cookieParser());


// ============================================================
// LANGUAGE
// ============================================================

app.use(language_middleware);


// ============================================================
// COMPRESSION CONFIGURATION
// ============================================================

const COMPRESSIBLE_TYPES = [

    // JSON
    "application/json",
    "application/ld+json",

    // JavaScript
    "application/javascript",
    "text/javascript",

    // HTML
    "text/html",
    "application/xhtml+xml",

    // CSS
    "text/css",

    // Text
    "text/plain",
    "text/xml",

    // XML
    "application/xml",
    "application/rss+xml",
    "application/atom+xml",

    // SVG
    "image/svg+xml",

    // Other text-based formats
    "application/sql",
    "application/wasm"
];


// ============================================================
// ALREADY COMPRESSED / BINARY TYPES
// ============================================================

const NEVER_COMPRESS_TYPES = [

    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/bmp",
    "image/x-icon",
    "image/vnd.microsoft.icon",

    // Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/aac",
    "audio/flac",

    // Video
    "video/mp4",
    "video/webm",
    "video/mpeg",
    "video/ogg",
    "video/quicktime",

    // Archives
    "application/zip",
    "application/gzip",
    "application/x-gzip",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "application/x-7z-compressed",
    "application/x-bzip2",
    "application/x-xz",
    "application/x-tar",

    // Fonts
    "font/woff",
    "font/woff2",

    // PDF
    "application/pdf"
];


// ============================================================
// FORMAT BYTES
// ============================================================

function formatBytes(bytes) {

    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 B";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 ** 2) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    if (bytes < 1024 ** 3) {
        return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
    }

    return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}


// ============================================================
// GET CONTENT TYPE
// ============================================================

function getContentType(res) {

    return (
        res.getHeader("Content-Type") ||
        res.getHeader("content-type") ||
        ""
    );
}


// ============================================================
// CHECK WHETHER RESPONSE CAN BE COMPRESSED
// ============================================================

function isCompressible(contentType) {

    if (!contentType) {
        return false;
    }

    const type = String(contentType)
        .split(";")[0]
        .trim()
        .toLowerCase();


    // Explicitly excluded
    if (NEVER_COMPRESS_TYPES.includes(type)) {
        return false;
    }


    // Explicitly compressible
    if (COMPRESSIBLE_TYPES.includes(type)) {
        return true;
    }


    // Any text/* content
    if (type.startsWith("text/")) {
        return true;
    }


    return false;
}


// ============================================================
// DETERMINE BEST COMPRESSION
// ============================================================

function getCompressionEncoding(acceptEncoding) {

    if (!acceptEncoding) {
        return null;
    }

    const value = String(acceptEncoding).toLowerCase();


    // Brotli
    //
    // We prefer Brotli whenever the browser advertises it.
    //
    if (
        /\bbr\b/.test(value) &&
        !/br\s*;\s*q\s*=\s*0(?:\.0*)?(?:\D|$)/.test(value)
    ) {
        return "br";
    }


    // Gzip fallback
    if (
        /\bgzip\b/.test(value) &&
        !/gzip\s*;\s*q\s*=\s*0(?:\.0*)?(?:\D|$)/.test(value)
    ) {
        return "gzip";
    }


    return null;
}


// ============================================================
// RESPONSE COMPRESSION MIDDLEWARE
// ============================================================

function compressionMiddleware(req, res, next) {
    const acceptEncoding = req.headers["accept-encoding"] || "";
    const compressionEncoding = getCompressionEncoding(acceptEncoding);

    if (!compressionEncoding || req.method === "HEAD" || req.headers.range)
        return next();

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalSetHeader = res.setHeader.bind(res);
    const originalRemoveHeader = res.removeHeader.bind(res);
    const chunks = [];

    res.write = function (chunk, enc, cb) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
        return true;
    };

    res.end = function (chunk, enc, cb) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));

        let body = Buffer.concat(chunks);
        const originalSize = body.length;
        const contentType = getContentType(res);
        const type = String(contentType).split(";")[0].trim().toLowerCase();

        if (res.statusCode === 204 || res.statusCode === 304 || !isCompressible(contentType))
            return (res.write = originalWrite, res.end = originalEnd, originalEnd(body, undefined, cb));

        // Minify ONLY JSON responses before compression
        if (type === "application/json" || type === "application/ld+json") {
            try {
                body = Buffer.from(JSON.stringify(JSON.parse(body.toString("utf8"))));
            } catch (error) {
                console.warn("[JSON MINIFY] Skipped:", error.message);
            }
        }

        const beforeSize = body.length;

        if (beforeSize < 1024)
            return (res.write = originalWrite, res.end = originalEnd, originalEnd(body, undefined, cb));

        const options = compressionEncoding === "br"
            ? { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }
            : { level: zlib.constants.Z_BEST_SPEED };

        const done = (error, compressed) => {
            if (error) {
                console.error("[COMPRESSION ERROR]", error);
                res.write = originalWrite;
                res.end = originalEnd;
                return originalEnd(body, undefined, cb);
            }

            const afterSize = compressed.length;
            const saved = beforeSize - afterSize;
            const percent = (saved / beforeSize) * 100;

            console.log("\n========== COMPRESSION ==========");
            console.log(`Method:       ${req.method}`);
            console.log(`URL:          ${req.originalUrl}`);
            console.log(`Type:         ${contentType}`);
            console.log(`Encoding:     ${compressionEncoding}`);
            console.log(`Original:     ${formatBytes(originalSize)}`);
            if (type === "application/json" || type === "application/ld+json")
                console.log(`JSON minified:${formatBytes(beforeSize)}`);
            console.log(`Compressed:   ${formatBytes(afterSize)}`);
            console.log(`Saved:        ${formatBytes(Math.max(0, saved))}`);
            console.log(`Compression:  ${Math.max(0, percent).toFixed(2)}%`);
            console.log("=================================\n");

            res.write = originalWrite;
            res.end = originalEnd;

            if (afterSize >= beforeSize)
                return originalEnd(body, undefined, cb);

            try {
                originalRemoveHeader("Content-Length");
                originalRemoveHeader("Content-Encoding");
            } catch (_) {}

            originalSetHeader("Content-Encoding", compressionEncoding);
            originalSetHeader("Content-Length", afterSize);
            originalSetHeader("Vary", "Accept-Encoding");

            return originalEnd(compressed, undefined, cb);
        };

        if (compressionEncoding === "br")
            zlib.brotliCompress(body, options, done);
        else
            zlib.gzip(body, options, done);

        return res;
    };

    next();
}


// ============================================================
// STATIC UPLOADS
//
// These are intentionally BEFORE compression.
// JPEG, PNG, PDF, videos, etc. should normally not be
// Brotli-compressed again.
// ============================================================

app.use(
    "/dcs/api/uploads",
    express.static(
        path.join(
            __dirname,
            config.upload_dir
        )
    )
);


// ============================================================
// SWAGGER
// ============================================================

app.use(
    "/dcs/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swagger_spec)
);


// ============================================================
/// ADMINISTRATIVE LOCATIONS API (No auth required)
// ============================================================

const locationsData = require("../location.min.json");

app.get("/dcs/api/administrative", compressionMiddleware, (req, res) => {
    res.json(locationsData);
});


// ============================================================
// LOCATIONS API (No auth required, for public forms)
// ============================================================

app.use("/dcs/api/locations", compressionMiddleware, locations_routes);


// ============================================================
// API
//
// Compression is applied ONLY to responses generated by
// dcs_routes.
// ============================================================

app.use(
    "/dcs/api",
    compressionMiddleware,
    dcs_routes
);


// ============================================================
// 404
// ============================================================

app.use(not_found_handler);


// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(global_error_handler);


// ============================================================
// DATABASE + SERVER
// ============================================================

connect_databases()

    .then(async (result) => {

        if (!result.status) {

            console.error(
                "Database connection failed:",
                result.error
            );

            return;
        }


        await ensure_submission_indexes();

        await ensure_location_indexes();


        app.listen(PORT, () => {

        console.log(
            "Server is running on port " + PORT
        );

    });

    })

    .catch((error) => {

        console.error(
            "Error connecting to databases:",
            error
        );

    });
