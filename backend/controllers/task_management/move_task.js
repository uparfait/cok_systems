const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const moveTask = async (req, res) => {
    try {
        const { taskId } = req.params
        const { fromListId, toListId, newPosition } = req.body

        if (!toListId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Destination list ID is required'
            })
        }

        // Get the current task to verify it exists
        const task = await Task.findById(taskId)
        if (!task) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task not found'
            })
        }

        // Map column IDs to statuses directly
        const statusMap = {
            'under-review': 'Under-review',
            'in-progress': 'In-progress',
            'completed': 'Completed'
        }

        const newStatus = statusMap[toListId] || task.status

        // Prepare update object
        const updateData = {
            status: newStatus,
            position: newPosition,
            updatedAt: new Date(),
            $push: {
                activities: {
                    user: req.user.userId,
                    action: 'moved',
                    details: {
                        fromStatus: task.status,
                        toStatus: newStatus,
                        position: newPosition,
                        toListId: toListId
                    },
                    timestamp: new Date()
                }
            }
        }

        // If moving to Completed status, set actualDateCompleted
        if (newStatus === 'Completed' && !task.actualDateCompleted) {
            updateData.actualDateCompleted = new Date()
        }

        // If moving away from Completed status, clear actualDateCompleted
        if (newStatus !== 'Completed' && task.actualDateCompleted) {
            updateData.actualDateCompleted = null
        }

        // Update task
        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            updateData,
            { new: true }
        )
            .populate('incharge', 'full_name email')
            .populate('members', 'full_name email')

        if (!updatedTask) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Task moved successfully',
            data: updatedTask
        })
    } catch (error) {
        console.error('Error moving task:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to move task',
            error: error.message
        })
    }
}

module.exports = moveTask
