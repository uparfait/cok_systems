const mongoose = require('mongoose');
const Visitor = require('../../models/visitor.js');
const {
    readVisitorInput, resolveVisitor, visitorView, emitVisitorUpdated, sendError, badRequest, notFound, conflict,
} = require('../../utilities/visitors');

/**
 * PUT /visitors/:id - change a visitor's details. Allowed only while the
 * visitor is in house; unique values owned by someone else are refused.
 */
module.exports = async function update_visitor(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest('Invalid visitor id');
        const current = await Visitor.findById(id).select('Is_In_House').lean();
        if (!current) throw notFound('Visitor not found');
        if (!current.Is_In_House) {
            throw conflict('Visitor details can only be changed while the visitor is in house');
        }

        const input = readVisitorInput(req.body || {});
        const { visitor, changed } = await resolveVisitor({ visitorId: id, input, user: req.user });
        if (changed) emitVisitorUpdated(visitor._id);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: changed ? 'Visitor details updated' : 'Nothing changed',
            data: visitorView(visitor),
        });
    } catch (error) {
        return sendError(res, error, 'Failed to update the visitor');
    }
};
