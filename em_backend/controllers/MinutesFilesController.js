const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const PostMeeting = require('../models/PostMeeting');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');
const config = require('../configurations/config');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'minutes');
const MAX_FILE_SIZE = 40 * 1024 * 1024 * 1024 * 1024; // 40TB per file

const sanitizeId = (id) => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');

async function findEventBySpecialId(eventSpecialId) {
  const collections = [LiveEvent, UpcomingEvent, RecurringEvent, PastEvent];
  for (const Model of collections) {
    const Rexp = new RegExp(`^${eventSpecialId}`, 'i');
    const event = await Model.findOne({ eventSpecialId: Rexp })
      .select('eventName eventSpecialId startedAt willStartAt willEndAt')
      .lean();
    if (event) return event;
  }
  return null;
}

// Minutes are stored as one string on PostMeeting. Files live on disk; the
// string holds a JSON payload of file metadata. Older HTML minutes are kept
// under legacyContent so they stay viewable.
function parsePayload(content) {
  if (!content || !String(content).trim()) return { files: [], legacyContent: null };
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.__cokFiles__) {
      return {
        files: Array.isArray(parsed.files) ? parsed.files : [],
        legacyContent: parsed.legacyContent || null,
      };
    }
  } catch {
    // not JSON: legacy HTML minutes
  }
  return { files: [], legacyContent: String(content) };
}

function serializePayload(files, legacyContent) {
  const payload = { __cokFiles__: true, version: 2, files };
  if (legacyContent) payload.legacyContent = legacyContent;
  return JSON.stringify(payload);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, sanitizeId(req.params.eventSpecialId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 20);
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

class MinutesFilesController {

  static uploadMiddleware(req, res, next) {
    upload.array('files')(req, res, (err) => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? 'File too large (max 40TB per file)'
          : err.message || 'Upload failed';
        return res.status(400).json({ success: false, message });
      }
      next();
    });
  }

  static async uploadFiles(req, res) {
    const uploaded = req.files || [];
    const cleanupUploaded = () => {
      uploaded.forEach((f) => { try { fs.unlinkSync(f.path); } catch { /* already gone */ } });
    };

    try {
      const { eventSpecialId } = req.params;
      const safeId = sanitizeId(eventSpecialId);

      if (!eventSpecialId) {
        cleanupUploaded();
        return res.status(400).json({ success: false, message: 'Event special ID is required' });
      }
      if (uploaded.length === 0) {
        return res.status(400).json({ success: false, message: 'No files were uploaded' });
      }

      let postMeeting = await PostMeeting.findOne({ eventSpecialId });
      let event = null;
      if (!postMeeting) {
        event = await findEventBySpecialId(eventSpecialId);
        if (!event) {
          cleanupUploaded();
          return res.status(404).json({ success: false, message: 'Event not found with the provided special ID' });
        }
      }

      const { files, legacyContent } = parsePayload(postMeeting?.meetingMinutes);

      const newEntries = uploaded.map((f) => ({
        id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        // multer decodes original names as latin1; restore proper UTF-8
        name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        type: f.mimetype || '',
        size: f.size,
        uploadedAt: new Date().toISOString(),
        storedName: f.filename,
        url: `${config.api.basePath}/uploads/minutes/${safeId}/${f.filename}`,
      }));

      const allFiles = [...files, ...newEntries];
      const serialized = serializePayload(allFiles, legacyContent);

      if (postMeeting) {
        postMeeting.meetingMinutes = serialized;
        await postMeeting.save();
      } else {
        postMeeting = await PostMeeting.create({
          meetingMinutes: serialized,
          documentedBy: {
            name: 'Minutes Files',
            role: 'System',
            institution: 'City of Kigali',
            email: 'system@kigalicity.gov.rw',
            phone: '',
          },
          meetingDate: event.startedAt || event.willStartAt || new Date(),
          eventSpecialId,
        });
      }

      return res.status(200).json({
        success: true,
        message: `${newEntries.length} file${newEntries.length > 1 ? 's' : ''} uploaded successfully`,
        data: { files: allFiles, legacyContent },
      });
    } catch (error) {
      console.error('Error uploading minutes files:', error);
      cleanupUploaded();
      return res.status(500).json({
        success: false,
        message: 'Error uploading files',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  }

  static async deleteFile(req, res) {
    try {
      const { eventSpecialId, fileId } = req.params;
      const safeId = sanitizeId(eventSpecialId);

      const postMeeting = await PostMeeting.findOne({ eventSpecialId });
      if (!postMeeting) {
        return res.status(404).json({ success: false, message: 'No minutes found for this event' });
      }

      const { files, legacyContent } = parsePayload(postMeeting.meetingMinutes);

      let nextFiles = files;
      let nextLegacy = legacyContent;

      if (fileId === 'legacy-minutes') {
        if (!legacyContent) {
          return res.status(404).json({ success: false, message: 'File not found' });
        }
        nextLegacy = null;
      } else {
        const target = files.find((f) => f.id === fileId);
        if (!target) {
          return res.status(404).json({ success: false, message: 'File not found' });
        }
        nextFiles = files.filter((f) => f.id !== fileId);

        // Remove the stored file from disk (base64 entries from the old format have no storedName)
        if (target.storedName) {
          const storedName = path.basename(target.storedName);
          const filePath = path.join(UPLOAD_ROOT, safeId, storedName);
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch (err) {
            console.error('Could not delete stored file:', err);
          }
        }
      }

      postMeeting.meetingMinutes = serializePayload(nextFiles, nextLegacy);
      await postMeeting.save();

      return res.status(200).json({
        success: true,
        message: 'File removed successfully',
        data: { files: nextFiles, legacyContent: nextLegacy },
      });
    } catch (error) {
      console.error('Error deleting minutes file:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting file',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  }
}

module.exports = MinutesFilesController;
