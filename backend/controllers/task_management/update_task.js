const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const updateTask = async (req, res) => {
    try {
        const { id } = req.params
        const updateData = req.body

        // Validate status and priority if provided
        const validStatuses = ['Under-review', 'In-progress', 'Completed']
        const validPriorities = ['Low', 'Medium', 'High']

        if (updateData.status && !validStatuses.includes(updateData.status)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            })
        }

        if (updateData.priority && !validPriorities.includes(updateData.priority)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid priority. Must be one of: ' + validPriorities.join(', ')
            })
        }

        // Convert dueDate to Date object if provided
        if (updateData.dueDate) {
            updateData.dueDate = new Date(updateData.dueDate)
        }

        // Add updatedAt timestamp
        updateData.updatedAt = new Date()

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('incharge', 'full_name email')
            .populate('belongs.itBelongsTo', 'full_name email')
            .populate('comments.commenter', 'full_name email')

        if (!updatedTask) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Task updated successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error updating task:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to update task',
            error: error.message
        })
    }
}

module.exports = updateTask