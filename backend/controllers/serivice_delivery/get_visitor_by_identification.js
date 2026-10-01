const { readVisitorInput, lookupVisitor, visitorView, sendError, badRequest } = require('../../utilities/visitors')

/**
 * GET /servicedelivery/visitor/by/identification/gate?id_type=&id_number=
 * The registered visitor with this ID number (to pre-fill the check-in form).
 */
module.exports = async function get_visitor_by_identification(req, res) {
    try {
        const { id_number = null, telephone = null } = req.query || {}
        if (!id_number && !telephone) throw badRequest('ID number is required')
        const input = readVisitorInput({ identification: { number: id_number }, telephone })
        const { visitor } = await lookupVisitor(input)
        if (!visitor) {
            return res.status(404).json({ success: false, type: 'warning', message: 'No registered visitor found with this ID number' })
        }
        return res.status(200).json({ success: true, type: 'success', message: 'Visitor found', data: visitorView(visitor) })
    } catch (error) {
        return sendError(res, error, 'Failed to find the visitor')
    }
}
