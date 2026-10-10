const mongoose = require('mongoose');
const Visitor = require('../../models/visitor.js');
const ServiceDelivery = require('../../models/service_delivery.js');
const { emitAttachmentsUpdated, sendError, badRequest, notFound, forbidden } = require('../../utilities/visitors');
const files = require('../../utilities/visitors/attachments.js');

const objectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) throw badRequest(`Invalid ${label}`);
    return new mongoose.Types.ObjectId(String(value));
};

async function visitorOrFail(id) {
    const visitorId = objectId(id, 'visitor id');
    const visitor = await Visitor.exists({ _id: visitorId });
    if (!visitor) throw notFound('Visitor not found');
    return visitorId;
}

/** Every attachment of the visitor: open visit first, newest first inside a visit. */
async function list_attachments(req, res) {
    try {
        const visitorId = await visitorOrFail(req.params.id);
        const rows = await ServiceDelivery.aggregate([
            { $match: { visitor: visitorId } },
            { $unwind: '$attachments' },
            { $sort: { is_still_inhouse: -1, entry_date: -1, 'attachments.uploaded_at': -1 } },
            { $project: { attachment: '$attachments', entry_date: 1, is_still_inhouse: 1 } },
        ]);
        const data = rows.map((row) => files.attachmentView(row.attachment, { _id: row._id, entry_date: row.entry_date, is_still_inhouse: row.is_still_inhouse }, req.user));
        return res.status(200).json({ success: true, type: 'success', data, total: data.length });
    } catch (error) {
        return sendError(res, error, 'Failed to load attachments');
    }
}

/**
 * POST /visitors/:id/attachments (multipart: files + descriptions, same order).
 * Goes to the open visit, else to the latest visit. Every file needs a description.
 */
async function add_attachments(req, res) {
    const uploaded = req.files || [];
    try {
        const visitorId = await visitorOrFail(req.params.id);
        if (uploaded.length === 0) throw badRequest('Choose at least one file');
        const descriptions = files.descriptionsFrom(req.body, uploaded.length);
        const missing = descriptions.findIndex((d) => !d);
        if (missing !== -1) throw badRequest(`Add a description for ${uploaded[missing].originalname || 'every file'}`);

        const visit = await ServiceDelivery.findOne({ visitor: visitorId }).sort({ is_still_inhouse: -1, entry_date: -1 }).select('_id').lean();
        if (!visit) throw notFound('This visitor has no visit to attach files to');

        const now = new Date();
        const uploader = files.uploaderOf(req.user);
        const docs = uploaded.map((file, i) => ({
            ...files.fileFields(file),
            description: descriptions[i],
            uploaded_by: uploader,
            uploaded_at: now,
            updated_at: null,
        }));
        await ServiceDelivery.updateOne({ _id: visit._id }, { $push: { attachments: { $each: docs } } });
        emitAttachmentsUpdated(visitorId, visit._id);
        return res.status(201).json({ success: true, type: 'success', message: `${docs.length} attachment${docs.length === 1 ? '' : 's'} added`, total: docs.length });
    } catch (error) {
        await files.removeUploaded(uploaded);
        return sendError(res, error, 'Failed to add the attachments');
    }
}

/** PUT /visitors/:id/attachments/:attachmentId - only the person who added it. */
async function update_attachment(req, res) {
    const replacement = (req.files && req.files[0]) || req.file || null;
    try {
        const visitorId = await visitorOrFail(req.params.id);
        const attachmentId = objectId(req.params.attachmentId, 'attachment id');
        const visit = await ServiceDelivery.findOne({ visitor: visitorId, 'attachments._id': attachmentId }).select('attachments.$').lean();
        const attachment = visit && visit.attachments && visit.attachments[0];
        if (!attachment) throw notFound('Attachment not found');

        const me = String((req.user && (req.user.id || req.user._id || req.user.userId)) || '');
        if (!me || String((attachment.uploaded_by && attachment.uploaded_by.user_id) || '') !== me) {
            throw forbidden('Only the person who added this attachment can change it');
        }

        const description = req.body && req.body.description !== undefined ? String(req.body.description).trim() : null;
        if (description !== null && !description) throw badRequest('The description cannot be empty');
        if (description === null && !replacement) throw badRequest('Nothing to update');

        const set = { 'attachments.$.updated_at': new Date() };
        if (description !== null) set['attachments.$.description'] = description;
        if (replacement) {
            const fields = files.fileFields(replacement);
            Object.keys(fields).forEach((key) => { set[`attachments.$.${key}`] = fields[key]; });
        }
        await ServiceDelivery.updateOne({ _id: visit._id, 'attachments._id': attachmentId }, { $set: set });
        if (replacement) await files.removeFile(attachment.stored_name);
        emitAttachmentsUpdated(visitorId, visit._id);
        return res.status(200).json({ success: true, type: 'success', message: 'Attachment updated' });
    } catch (error) {
        if (replacement) await files.removeUploaded([replacement]);
        return sendError(res, error, 'Failed to update the attachment');
    }
}

/** GET /visitors/attachments/:attachmentId/file - authenticated download. */
async function download_attachment(req, res) {
    try {
        const attachmentId = objectId(req.params.attachmentId, 'attachment id');
        const visit = await ServiceDelivery.findOne({ 'attachments._id': attachmentId }).select('attachments.$').lean();
        const attachment = visit && visit.attachments && visit.attachments[0];
        if (!attachment) throw notFound('Attachment not found');
        const fullPath = files.absolutePath(attachment.stored_name);
        if (!fullPath) throw notFound('Attachment file not found');
        const name = encodeURIComponent(attachment.file_name || 'attachment');
        res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${name}`);
        return res.sendFile(fullPath, (error) => {
            if (error && !res.headersSent) res.status(404).json({ success: false, type: 'warning', message: 'Attachment file not found' });
        });
    } catch (error) {
        return sendError(res, error, 'Failed to download the attachment');
    }
}

module.exports = {
    list_attachments,
    add_attachments,
    update_attachment,
    download_attachment,
};
