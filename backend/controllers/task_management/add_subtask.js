const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const addSubtask = async (req, res) => {
    try {
        const { id } = req.params
        const { title, description, status = 'Under-review', priority = 'Medium', dueDate } = req.body

        if (!title) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Title is required for subtask'
            })
        }

        // Validate status and priority
        const validStatuses = ['Under-review', 'In-progress', 'Completed']
        const validPriorities = ['Low', 'Medium', 'High']

        if (!validStatuses.includes(status)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid subtask status'
            })
        }

        if (!validPriorities.includes(priority)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid subtask priority'
            })
        }

        const newSubtask = {
            title,
            description: description || '',
            status,
            priority,
            dueDate: dueDate ? new Date(dueDate) : null,
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                $push: { subtasks: newSubtask },
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
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
            message: 'Subtask added successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error adding subtask:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to add subtask',
            error: error.message
        })
    }
}

module.exports = addSubtask