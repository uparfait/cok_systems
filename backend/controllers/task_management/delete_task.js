const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const deleteTask = async (req, res) => {
    try {
        const { id } = req.params

        const deletedTask = await Task.findByIdAndDelete(id)

        if (!deletedTask) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Task deleted successfully',
            data: deletedTask
        })

    } catch (error) {
        console.error('Error deleting task:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to delete task',
            error: error.message
        })
    }
}

module.exports = deleteTask