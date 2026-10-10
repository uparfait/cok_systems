const mongoose = require('mongoose');
const Visitor = require('../../models/visitor.js');
const ServiceDelivery = require('../../models/service_delivery.js');
const { emitAttachmentsUpdated, sendError, badRequest, notFound, forbidden } = require('../../utilities/visitors');
const files = require('../../utilities/visitors/attachments.js');

const PAGE_LIMIT = 10;
const MAX_LIMIT = 50;

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

const userIdOf = (user) => String((user && (user.id || user._id || user.userId)) || '');

/**
 * GET /visitors/:id/attachments?page=&limit=
 * Attachments grouped as they were added (one description, many files):
 * open visit first, newest first. 10 groups per page.
 */
async function list_attachments(req, res) {
    try {
        const visitorId = await visitorOrFail(req.params.id);
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || PAGE_LIMIT));
        const [result] = await ServiceDelivery.aggregate([
            { $match: { visitor: visitorId, 'attachments.0': { $exists: true } } },
            { $unwind: '$attachments' },
            { $sort: { 'attachments.uploaded_at': -1, 'attachments._id': -1 } },
            {
                $group: {
                    _id: { $ifNull: ['$attachments.batch', '$attachments._id'] },
                    visit_id: { $first: '$_id' },
                    entry_date: { $first: '$entry_date' },
                    is_still_inhouse: { $first: '$is_still_inhouse' },
                    description: { $first: '$attachments.description' },
                    uploaded_by: { $first: '$attachments.uploaded_by' },
                    uploaded_at: { $first: '$attachments.uploaded_at' },
                    updated_at: { $max: '$attachments.updated_at' },
                    files: { $push: { _id: '$attachments._id', file_name: '$attachments.file_name', mime_type: '$attachments.mime_type', size: '$attachments.size' } },
                },
            },
            { $sort: { is_still_inhouse: -1, entry_date: -1, uploaded_at: -1, _id: -1 } },
            { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'total' }] } },
        ]);
        const total = result && result.count[0] ? result.count[0].total : 0;
        const me = userIdOf(req.user);
        const data = (result ? result.rows : []).map((row) => ({
            batch: row._id,
            description: row.description,
            uploaded_by: row.uploaded_by || {},
            uploaded_at: row.uploaded_at,
            updated_at: row.updated_at || null,
            can_edit: !!me && String((row.uploaded_by && row.uploaded_by.user_id) || '') === me,
            visit: { _id: row.visit_id, entry_date: row.entry_date, is_still_inhouse: !!row.is_still_inhouse },
            files: row.files,
        }));
        return res.status(200).json({ success: true, type: 'success', data, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error) {
        return sendError(res, error, 'Failed to load attachments');
    }
}

/**
 * POST /visitors/:id/attachments (multipart: files + one description, or one
 * description per file in the same order). Goes to the open visit, else to
 * the latest visit. The files of one request form one batch.
 */
async function add_attachments(req, res) {
    const uploaded = req.files || [];
    try {
        const visitorId = await visitorOrFail(req.params.id);
        if (uploaded.length === 0) throw badRequest('Choose at least one file');
        const descriptions = files.descriptionsFrom(req.body, uploaded.length);
        const missing = descriptions.findIndex((d) => !d);
        if (missing !== -1) throw badRequest('Add a description');

        const visit = await ServiceDelivery.findOne({ visitor: visitorId }).sort({ is_still_inhouse: -1, entry_date: -1 }).select('_id').lean();
        if (!visit) throw notFound('This visitor has no visit to attach files to');

        const now = new Date();
        const batch = new mongoose.Types.ObjectId();
        const uploader = files.uploaderOf(req.user);
        const docs = uploaded.map((file, i) => ({
            ...files.fileFields(file),
            batch,
            description: descriptions[i],
            uploaded_by: uploader,
            uploaded_at: now,
            updated_at: null,
        }));
        await ServiceDelivery.updateOne({ _id: visit._id }, { $push: { attachments: { $each: docs } } });
        emitAttachmentsUpdated(visitorId, visit._id);
        return res.status(201).json({ success: true, type: 'success', message: `${docs.length} file${docs.length === 1 ? '' : 's'} saved`, total: docs.length, batch });
    } catch (error) {
        await files.removeUploaded(uploaded);
        return sendError(res, error, 'Failed to add the attachments');
    }
}

/**
 * PUT /visitors/:id/attachments/:attachmentId - only the person who added it.
 * A new description applies to every file of the same batch; a file replaces
 * only this attachment's file.
 */
async function update_attachment(req, res) {
    const replacement = (req.files && req.files[0]) || req.file || null;
    try {
        const visitorId = await visitorOrFail(req.params.id);
        const attachmentId = objectId(req.params.attachmentId, 'attachment id');
        const visit = await ServiceDelivery.findOne({ visitor: visitorId, 'attachments._id': attachmentId }).select('attachments.$').lean();
        const attachment = visit && visit.attachments && visit.attachments[0];
        if (!attachment) throw notFound('Attachment not found');

        const me = userIdOf(req.user);
        if (!me || String((attachment.uploaded_by && attachment.uploaded_by.user_id) || '') !== me) {
            throw forbidden('Only the person who added this attachment can change it');
        }

        const description = req.body && req.body.description !== undefined ? String(req.body.description).trim() : null;
        if (description !== null && !description) throw badRequest('The description cannot be empty');
        if (description === null && !replacement) throw badRequest('Nothing to update');

        const now = new Date();
        if (description !== null) {
            const sameBatch = attachment.batch ? { 'item.batch': attachment.batch } : { 'item._id': attachmentId };
            await ServiceDelivery.updateOne(
                { _id: visit._id },
                { $set: { 'attachments.$[item].description': description, 'attachments.$[item].updated_at': now } },
                { arrayFilters: [sameBatch] },
            );
        }
        if (replacement) {
            const set = { 'attachments.$.updated_at': now };
            const fields = files.fileFields(replacement);
            Object.keys(fields).forEach((key) => { set[`attachments.$.${key}`] = fields[key]; });
            await ServiceDelivery.updateOne({ _id: visit._id, 'attachments._id': attachmentId }, { $set: set });
            await files.removeFile(attachment.stored_name);
        }
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
