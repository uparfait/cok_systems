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

    const acceptEncoding =
        req.headers["accept-encoding"] || "";


    // --------------------------------------------------------
    // Determine browser support
    // --------------------------------------------------------

    const compressionEncoding =
        getCompressionEncoding(acceptEncoding);


    // Browser supports neither Brotli nor Gzip
    if (!compressionEncoding) {
        return next();
    }


    // --------------------------------------------------------
    // HEAD has no response body
    // --------------------------------------------------------

    if (req.method === "HEAD") {
        return next();
    }


    // --------------------------------------------------------
    // Range requests
    //
    // Important for files, video, audio, etc.
    // --------------------------------------------------------

    if (req.headers.range) {
        return next();
    }


    // --------------------------------------------------------
    // Save original methods
    // --------------------------------------------------------

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    const originalSetHeader =
        res.setHeader.bind(res);

    const originalRemoveHeader =
        res.removeHeader.bind(res);


    // --------------------------------------------------------
    // Store response chunks
    // --------------------------------------------------------

    const chunks = [];


    // ========================================================
    // res.write()
    // ========================================================

    res.write = function (
        chunk,
        chunkEncoding,
        callback
    ) {

        if (chunk) {

            const buffer = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(
                    chunk,
                    chunkEncoding
                );

            chunks.push(buffer);
        }


        // Do not send anything yet.
        // We need the complete response before compressing.
        return true;
    };


    // ========================================================
    // res.end()
    // ========================================================

    res.end = function (
        chunk,
        chunkEncoding,
        callback
    ) {

        if (chunk) {

            const buffer = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(
                    chunk,
                    chunkEncoding
                );

            chunks.push(buffer);
        }


        // ----------------------------------------------------
        // Build complete original response
        // ----------------------------------------------------

        const body = Buffer.concat(chunks);

        const beforeSize = body.length;


        // ----------------------------------------------------
        // Get response Content-Type
        // ----------------------------------------------------

        const contentType =
            getContentType(res);


        // ----------------------------------------------------
        // Status codes that should not have compressed body
        // ----------------------------------------------------

        if (
            res.statusCode === 204 ||
            res.statusCode === 304
        ) {

            res.write = originalWrite;
            res.end = originalEnd;

            return originalEnd(
                body,
                undefined,
                callback
            );
        }


        // ====================================================
        // NOT COMPRESSIBLE
        // ====================================================

        if (!isCompressible(contentType)) {

            console.log(
                "\n========== COMPRESSION =========="
            );

            console.log(
                `Method:       ${req.method}`
            );

            console.log(
                `URL:          ${req.originalUrl}`
            );

            console.log(
                `Type:         ${contentType || "unknown"}`
            );

            console.log(
                `Encoding:     NONE`
            );

            console.log(
                `Before:       ${formatBytes(beforeSize)}`
            );

            console.log(
                `After:        NOT COMPRESSED`
            );

            console.log(
                "Reason:       Content type is not compressible"
            );

            console.log(
                "=================================\n"
            );


            res.write = originalWrite;
            res.end = originalEnd;


            return originalEnd(
                body,
                undefined,
                callback
            );
        }


        // ====================================================
        // VERY SMALL RESPONSE
        // ====================================================

        // Compression can make very small responses larger.
        if (beforeSize < 1024) {

            console.log(
                "\n========== COMPRESSION =========="
            );

            console.log(
                `Method:       ${req.method}`
            );

            console.log(
                `URL:          ${req.originalUrl}`
            );

            console.log(
                `Type:         ${contentType}`
            );

            console.log(
                `Encoding:     NONE`
            );

            console.log(
                `Before:       ${formatBytes(beforeSize)}`
            );

            console.log(
                `After:        NOT COMPRESSED`
            );

            console.log(
                "Reason:       Response smaller than 1 KB"
            );

            console.log(
                "=================================\n"
            );


            res.write = originalWrite;
            res.end = originalEnd;


            return originalEnd(
                body,
                undefined,
                callback
            );
        }


        // ====================================================
        // COMPRESSION OPTIONS
        // ====================================================

        let compressionOptions;


        if (compressionEncoding === "br") {

            compressionOptions = {

                params: {

                    // 0-11
                    //
                    // 5 is a good balance between:
                    // compression ratio
                    // CPU usage
                    //
                    [zlib.constants.BROTLI_PARAM_QUALITY]: 5
                }
            };

        } else {

            compressionOptions = {

                // Fast gzip compression
                level: zlib.constants.Z_BEST_SPEED
            };
        }


        // ====================================================
        // COMPRESSION COMPLETE
        // ====================================================

        const compressionComplete =
            (error, compressed) => {

                // --------------------------------------------
                // Compression error
                // --------------------------------------------

                if (error) {

                    console.error(
                        "\n[COMPRESSION ERROR]",
                        error
                    );


                    res.write = originalWrite;
                    res.end = originalEnd;


                    return originalEnd(
                        body,
                        undefined,
                        callback
                    );
                }


                const afterSize =
                    compressed.length;


                const saved =
                    beforeSize - afterSize;


                const percentage =
                    beforeSize > 0
                        ? (saved / beforeSize) * 100
                        : 0;


                // =================================================
                // Compression actually made response larger
                // =================================================

                if (afterSize >= beforeSize) {

                    console.log(
                        "\n========== COMPRESSION =========="
                    );

                    console.log(
                        `Method:       ${req.method}`
                    );

                    console.log(
                        `URL:          ${req.originalUrl}`
                    );

                    console.log(
                        `Type:         ${contentType}`
                    );

                    console.log(
                        `Encoding:     NONE`
                    );

                    console.log(
                        `Before:       ${formatBytes(beforeSize)}`
                    );

                    console.log(
                        `After:        ${formatBytes(afterSize)}`
                    );

                    console.log(
                        "Saved:        0 B"
                    );

                    console.log(
                        "Compression:  0.00%"
                    );

                    console.log(
                        "Reason:       Compressed result was not smaller"
                    );

                    console.log(
                        "=================================\n"
                    );


                    res.write = originalWrite;
                    res.end = originalEnd;


                    return originalEnd(
                        body,
                        undefined,
                        callback
                    );
                }


                // =================================================
                // SUCCESS
                // =================================================

                console.log(
                    "\n========== COMPRESSION =========="
                );

                console.log(
                    `Method:       ${req.method}`
                );

                console.log(
                    `URL:          ${req.originalUrl}`
                );

                console.log(
                    `Type:         ${contentType}`
                );

                console.log(
                    `Encoding:     ${compressionEncoding}`
                );

                console.log(
                    `Before:       ${formatBytes(beforeSize)}`
                );

                console.log(
                    `After:        ${formatBytes(afterSize)}`
                );

                console.log(
                    `Saved:        ${formatBytes(saved)}`
                );

                console.log(
                    `Compression:  ${percentage.toFixed(2)}%`
                );

                console.log(
                    "=================================\n"
                );


                // =================================================
                // Remove old Content-Length
                // =================================================

                try {
                    originalRemoveHeader("Content-Length");
                } catch (_) {}


                // =================================================
                // Set compression headers
                // =================================================

                originalSetHeader(
                    "Content-Encoding",
                    compressionEncoding
                );

                originalSetHeader(
                    "Content-Length",
                    afterSize
                );

                originalSetHeader(
                    "Vary",
                    "Accept-Encoding"
                );


                // =================================================
                // Restore original methods
                // =================================================

                res.write = originalWrite;
                res.end = originalEnd;


                // =================================================
                // Send compressed response
                // =================================================

                return originalEnd(
                    compressed,
                    undefined,
                    callback
                );
            };


        // ====================================================
        // COMPRESS
        // ====================================================

        if (compressionEncoding === "br") {

            zlib.brotliCompress(
                body,
                compressionOptions,
                compressionComplete
            );

        } else {

            zlib.gzip(
                body,
                compressionOptions,
                compressionComplete
            );
        }


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
