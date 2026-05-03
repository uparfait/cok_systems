const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params
        const { status } = req.body

        // Validate status
        const validStatuses = ['Under-review', 'In-progress', 'Completed']
        if (!status || !validStatuses.includes(status)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            })
        }

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                status,
                updatedAt: new Date()
            },
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
            message: 'Task status updated successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error updating task status:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to update task status',
            error: error.message
        })
    }
}

module.exports = updateTaskStatus