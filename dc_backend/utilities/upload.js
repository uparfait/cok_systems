const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const config = require("../configurations/config.js");

const SUBMISSION_UPLOAD_DIR = path.join(__dirname, "..", config.upload_dir, "submissions");
const DESIGN_UPLOAD_DIR = path.join(__dirname, "..", config.upload_dir, "design");
const APPROVAL_UPLOAD_DIR = path.join(__dirname, "..", config.upload_dir, "approvals");
const IMPORT_UPLOAD_DIR = path.join(__dirname, "..", config.upload_dir, "imports");
fs.mkdirSync(SUBMISSION_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DESIGN_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(APPROVAL_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(IMPORT_UPLOAD_DIR, { recursive: true });

// What browsers declare for a .csv or an .xlsx: Windows often calls a
// .csv Excel, some say plain text or nothing in particular.
const IMPORT_EXTENSIONS = [".csv", ".xlsx"];
const IMPORT_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "text/x-csv",
  "application/x-csv",
  "text/comma-separated-values",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
];

function make_disk_storage(destination) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname);
      const random_name = crypto.randomBytes(16).toString("hex");
      cb(null, `${random_name}${extension}`);
    },
  });
}

/**
 * Disk storage for every respondent-uploaded file (image/video/audio/
 * generic upload/signature) - the whole point of this endpoint is that
 * these bytes never touch MongoDB, only the resulting URL does.
 * Deliberately no size limit here either - a hard cap at this layer would
 * reject a file with multer's own generic "File too large" error before
 * the controller ever runs, bypassing the field's own configured limit
 * entirely (or lack of one). The only size check that should ever apply is
 * the per-field one the designer explicitly opted into, enforced in
 * upload_file.js/get_max_size_bytes - unlimited unless they set it.
 */
const upload_submission_file = multer({
  storage: make_disk_storage(SUBMISSION_UPLOAD_DIR),
});

/**
 * Disk storage for a form author's own content-block files (the "File" and
 * "Image" design components) - authored once while building the form, not
 * collected from a respondent, but the same "never embed bytes in Mongo"
 * rule applies: this is what would otherwise land in the schema document
 * itself as a base64 string. Deliberately no size limit - the designer is
 * an authenticated, trusted role, not a public respondent, and was
 * explicitly asked not to be capped here.
 */
const upload_design_file = multer({
  storage: make_disk_storage(DESIGN_UPLOAD_DIR),
});

/** Disk storage for an approver's drawn signature PNG or uploaded digital certificate - same "URL only, never bytes in Mongo" rule. */
const upload_approval_file = multer({
  storage: make_disk_storage(APPROVAL_UPLOAD_DIR),
});

/**
 * The CSV or Excel file a form editor imports responses from: kept in its
 * own folder until the import has run, then removed. Only a .csv or an
 * .xlsx is taken (.xls is not: the spreadsheet library reads neither) -
 * the extension and the declared type are both checked; anything else is
 * dropped here and the controller answers 422 (req.import_file_rejected).
 */
const upload_import_file = multer({
  storage: make_disk_storage(IMPORT_UPLOAD_DIR),
  fileFilter: (req, file, cb) => {
    const extension_ok = IMPORT_EXTENSIONS.includes(path.extname(file.originalname || "").toLowerCase());
    const type_ok = IMPORT_MIME_TYPES.includes(String(file.mimetype || "").toLowerCase());
    if (!extension_ok || !type_ok) req.import_file_rejected = true;
    cb(null, extension_ok && type_ok);
  },
});

module.exports = { upload_submission_file, upload_design_file, upload_approval_file, upload_import_file, IMPORT_UPLOAD_DIR };
