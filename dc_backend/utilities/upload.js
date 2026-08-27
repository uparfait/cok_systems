const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const config = require("../configurations/config.js");

const SUBMISSION_UPLOAD_DIR = path.join(__dirname, "..", config.upload_dir, "submissions");
const DESIGN_UPLOAD_DIR = path.join(__dirname, "..", config.upload_dir, "design");
const APPROVAL_UPLOAD_DIR = path.join(__dirname, "..", config.upload_dir, "approvals");
fs.mkdirSync(SUBMISSION_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DESIGN_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(APPROVAL_UPLOAD_DIR, { recursive: true });

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

module.exports = { upload_submission_file, upload_design_file, upload_approval_file };
