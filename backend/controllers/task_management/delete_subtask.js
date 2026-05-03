const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const deleteSubtask = async (req, res) => {
    try {
        const { id, subtaskId } = req.params

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                $pull: { subtasks: { _id: subtaskId } },
                updatedAt: new Date()
            },
            { new: true }
        )
            .populate('incharge', 'full_name email')
            .populate('comments.commenter', 'full_name email')

        if (!updatedTask) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Subtask deleted successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error deleting subtask:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to delete subtask',
            error: error.message
        })
    }
}

module.exports = deleteSubtask