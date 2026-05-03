const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const updateSubtask = async (req, res) => {
    try {
        const { id, subtaskId } = req.params
        const updateData = req.body

        // Validate status and priority if provided
        const validStatuses = ['Under-review', 'In-progress', 'Completed']
        const validPriorities = ['Low', 'Medium', 'High']

        if (updateData.status && !validStatuses.includes(updateData.status)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid subtask status'
            })
        }

        if (updateData.priority && !validPriorities.includes(updateData.priority)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid subtask priority'
            })
        }

        // Convert dueDate to Date object if provided
        if (updateData.dueDate) {
            updateData.dueDate = new Date(updateData.dueDate)
        }

        // Add updatedAt timestamp
        updateData.updatedAt = new Date()

        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, 'subtasks._id': subtaskId },
            {
                $set: {
                    'subtasks.$': { ...updateData, _id: subtaskId },
                    updatedAt: new Date()
                }
            },
            { new: true, runValidators: true }
        )
            .populate('incharge', 'full_name email')
            .populate('comments.commenter', 'full_name email')

        if (!updatedTask) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task or subtask not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Subtask updated successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error updating subtask:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to update subtask',
            error: error.message
        })
    }
}

module.exports = updateSubtask