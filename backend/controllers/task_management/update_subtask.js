const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const updateChecklist = async (req, res) => {
    try {
        const { id, checklistId } = req.params
        const { itemIndex, completed, title, items, itemText, deleteItemIndex } = req.body

        const updateFields = {}
        let updateMessage = 'Checklist updated successfully'

        if (typeof itemIndex === 'number' && typeof completed === 'boolean') {
            // Update specific item completion
            updateFields[`checklists.$.items.${itemIndex}.completed`] = completed
            updateMessage = 'Checklist item updated successfully'
        } else if (typeof itemIndex === 'number' && itemText !== undefined) {
            // Update specific item text
            updateFields[`checklists.$.items.${itemIndex}.text`] = itemText.trim()
            updateMessage = 'Checklist item text updated successfully'
        } else if (typeof deleteItemIndex === 'number') {
            // Delete specific item from checklist
            updateMessage = 'Checklist item deleted successfully'
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

        let updatedTask

        if (typeof deleteItemIndex === 'number') {
            // Handle item deletion using $unset and $pull
            const task = await Task.findOne({ _id: id, 'checklists._id': checklistId })

            if (!task) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: 'Task or checklist not found'
                })
            }

            const checklist = task.checklists.find(c => c._id.toString() === checklistId)
            if (!checklist || deleteItemIndex >= checklist.items.length) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Invalid item index'
                })
            }

            // Remove the item from the array
            checklist.items.splice(deleteItemIndex, 1)

            updatedTask = await Task.findOneAndUpdate(
                { _id: id, 'checklists._id': checklistId },
                {
                    $set: {
                        'checklists.$.items': checklist.items,
                        'checklists.$.updatedAt': new Date(),
                        updatedAt: new Date()
                    }
                },
                { new: true, runValidators: true }
            )
                .populate('incharge', 'full_name email')
                .populate('comments.commenter', 'full_name email')
                .populate('attachmentsFile.uploadedBy', 'full_name email')
        } else {
            updatedTask = await Task.findOneAndUpdate(
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
        }

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