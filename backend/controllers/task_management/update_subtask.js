const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const updateChecklist = async (req, res) => {
    try {
        const { id, checklistId } = req.params
        const { itemIndex, completed, title, items } = req.body

        const updateFields = {}
        let updateMessage = 'Checklist updated successfully'

        if (typeof itemIndex === 'number' && typeof completed === 'boolean') {
            // Update specific item completion
            updateFields[`checklists.$.items.${itemIndex}.completed`] = completed
            updateMessage = 'Checklist item updated successfully'
        } else if (title) {
            // Update checklist title
            updateFields['checklists.$.title'] = title
        } else if (Array.isArray(items)) {
            // Update entire items array
            updateFields['checklists.$.items'] = items.map(item => ({
                text: item.text.trim(),
                completed: item.completed || false
            }))
        } else {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid update data'
            })
        }

        // Add updatedAt timestamp
        updateFields['checklists.$.updatedAt'] = new Date()

        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, 'checklists._id': checklistId },
            {
                $set: updateFields,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        )
            .populate('incharge', 'full_name email')
            .populate('comments.commenter', 'full_name email')
            .populate('attachmentsFile.uploadedBy', 'full_name email')

        if (!updatedTask) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task or checklist not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: updateMessage,
            data: updatedTask
        })

    } catch (error) {
        console.error('Error updating checklist:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to update checklist',
            error: error.message
        })
    }
}

module.exports = updateChecklist