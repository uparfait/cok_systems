const express = require('express');
const multer = require('multer');
const InviteController = require('../controllers/InviteController');

// Memory storage for file parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExts = /\.(csv|txt|xlsx|xls)$/i;
    if (allowedMimes.includes(file.mimetype) || allowedExts.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, TXT, and Excel files are allowed'), false);
    }
  },
});

const router = express.Router();

// POST /events/:eventSpecialId/invite
router.post('/:eventSpecialId/invite', upload.single('file'), InviteController.handleInvite);

// GET /events/:eventSpecialId/invited
router.get('/:eventSpecialId/invited', InviteController.handleGetInvited);

// DELETE /events/invited/:inviteId
router.delete('/invited/:inviteId', InviteController.handleRemoveInvited);

module.exports = router;
