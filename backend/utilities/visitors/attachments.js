/**
 * Visitor attachment storage. Files go to uploads/visitor_attachments/<yyyy>/<mm>/
 * (inside the backend_uploads volume) and are only served through the
 * authenticated download endpoint, never through the public /uploads route.
 * No count or size limit, as requested.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const ROOT = path.join(__dirname, '../../uploads/visitor_attachments');

const safeName = (name) => {
    const base = String(name || 'file').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');
    return (base.length > 120 ? base.slice(base.length - 120) : base) || 'file';
};

const storage = multer.diskStorage({
    destination(req, file, cb) {
        const now = new Date();
        const relative = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
        const dir = path.join(ROOT, relative);
        fs.mkdir(dir, { recursive: true }, (error) => {
            file.relativeDir = relative;
            cb(error, dir);
        });
    },
    filename(req, file, cb) {
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName(file.originalname)}`);
    },
});

// defParamCharset keeps non-ASCII file names readable (multer reads latin1 otherwise)
const upload = multer({ storage, defParamCharset: 'utf8' });

/** Path stored on the attachment, relative to ROOT, always with forward slashes. */
const storedNameOf = (file) => path.join(file.relativeDir || '', file.filename).split(path.sep).join('/');

/** Absolute path for a stored name; refuses anything outside ROOT. */
function absolutePath(storedName) {
    const full = path.resolve(ROOT, String(storedName || ''));
    if (!full.startsWith(path.resolve(ROOT) + path.sep)) return null;
    return full;
}

function removeFile(storedName) {
    const full = absolutePath(storedName);
    if (!full) return Promise.resolve();
    return fs.promises.unlink(full).catch(() => {});
}

function removeUploaded(files) {
    return Promise.all((files || []).map((file) => fs.promises.unlink(file.path).catch(() => {})));
}

/** Descriptions arrive as one string or an array, in the same order as the files. */
function descriptionsFrom(body, count) {
    const raw = body ? (body.descriptions ?? body['descriptions[]'] ?? body.description) : undefined;
    const list = Array.isArray(raw) ? raw : (raw === undefined ? [] : [raw]);
    return Array.from({ length: count }, (_, i) => String(list[i] ?? '').trim());
}

function uploaderOf(user) {
    const dept = user && user.department;
    return {
        user_id: String((user && (user.id || user._id || user.userId)) || ''),
        name: (user && (user.name || user.full_name || user.fullName)) || '',
        email: (user && user.email) || '',
        telephone: (user && user.telephone) || '',
        department_id: dept && typeof dept === 'object' && dept._id ? String(dept._id) : (dept ? String(dept) : ''),
        department_name: (dept && typeof dept === 'object' && dept.department_name) || '',
    };
}

function fileFields(file) {
    return {
        file_name: file.originalname || file.filename,
        stored_name: storedNameOf(file),
        mime_type: file.mimetype || 'application/octet-stream',
        size: file.size || 0,
    };
}

function attachmentView(attachment, visit, user) {
    const me = String((user && (user.id || user._id || user.userId)) || '');
    return {
        _id: attachment._id,
        description: attachment.description,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type,
        size: attachment.size,
        uploaded_by: attachment.uploaded_by || {},
        uploaded_at: attachment.uploaded_at,
        updated_at: attachment.updated_at || null,
        can_edit: !!me && String((attachment.uploaded_by && attachment.uploaded_by.user_id) || '') === me,
        visit: visit ? { _id: visit._id, entry_date: visit.entry_date, is_still_inhouse: !!visit.is_still_inhouse } : null,
    };
}

module.exports = {
    ROOT,
    upload,
    absolutePath,
    removeFile,
    removeUploaded,
    descriptionsFrom,
    uploaderOf,
    fileFields,
    attachmentView,
};
