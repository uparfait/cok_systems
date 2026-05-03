const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const getTaskById = async (req, res) => {
    try {
        const { id } = req.params

        const task = await Task.findById(id)
            .populate('incharge', 'full_name email department')
            .populate('belongs.itBelongsTo', 'full_name email')
            .populate('comments.commenter', 'full_name email')
            .populate('subtasks', '-__v')

        if (!task) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Task retrieved successfully',
            data: task
        })

    } catch (error) {
        console.error('Error getting task by ID:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to retrieve task',
            error: error.message
        })
    }
}

module.exports = getTaskById