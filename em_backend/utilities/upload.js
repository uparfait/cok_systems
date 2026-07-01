const multer = require('multer');
const path   = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = crypto.randomBytes(10).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10000 * 1024 * 1024 }, // 10 GB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|msword|vnd\.openxmlformats|vnd\.ms-excel|jpeg|jpg|png/i;
    cb(null, allowed.test(file.mimetype));
  },
});

module.exports = upload;