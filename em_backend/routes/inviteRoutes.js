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

const rbac = require('../middlewares/rbac');

const router = express.Router();

// Organizers invite from the public event pages (no bearer); a signed-in
// caller must be an event manager.
const manageInvitesIfSignedIn = rbac.requireLinksIfSignedIn('events');

// POST /events/:eventSpecialId/invite
router.post('/:eventSpecialId/invite', manageInvitesIfSignedIn, upload.single('file'), InviteController.handleInvite);

// GET /events/:eventSpecialId/invited
router.get('/:eventSpecialId/invited', InviteController.handleGetInvited);

// DELETE /events/invited/:inviteId
router.delete('/invited/:inviteId', manageInvitesIfSignedIn, InviteController.handleRemoveInvited);

// PATCH /events/invited/:inviteId/reactivate
router.patch('/invited/:inviteId/reactivate', manageInvitesIfSignedIn, InviteController.handleReactivate);

module.exports = router;
