const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const createTask = async (req, res) => {
    try {
        const {
            belongs,
            incharge,
            title,
            description,
            status = 'Under-review',
            priority = 'Medium',
            dueDate,
            taskConfig,
            subtasks = []
        } = req.body

        // Validate required fields
        if (!incharge || !title || !dueDate) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Incharge, title, and dueDate are required'
            })
        }

        // Validate status and priority
        const validStatuses = ['Under-review', 'In-progress', 'Completed']
        const validPriorities = ['Low', 'Medium', 'High']

        if (!validStatuses.includes(status)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            })
        }

        if (!validPriorities.includes(priority)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid priority. Must be one of: ' + validPriorities.join(', ')
            })
        }

        // Validate subtasks if provided
        if (subtasks && subtasks.length > 0) {
            for (const subtask of subtasks) {
                if (!subtask.title) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: 'All subtasks must have a title'
                    })
                }
                if (subtask.status && !validStatuses.includes(subtask.status)) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: 'Invalid subtask status: ' + subtask.status
                    })
                }
                if (subtask.priority && !validPriorities.includes(subtask.priority)) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: 'Invalid subtask priority: ' + subtask.priority
                    })
                }
            }
        }

        const newTask = new Task({
            belongs: belongs || { isBelongsTo: false },
            incharge,
            title,
            description,
            status,
            priority,
            dueDate: new Date(dueDate),
            taskConfig: taskConfig || {},
            subtasks: subtasks.map(subtask => ({
                ...subtask,
                status: subtask.status || 'Under-review',
                priority: subtask.priority || 'Medium'
            }))
        })

        const savedTask = await newTask.save()

        res.status(StatusCodes.CREATED).json({
            status: true,
            message: 'Task created successfully',
            data: savedTask
        })

    } catch (error) {
        console.error('Error creating task:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to create task',
            error: error.message
        })
    }
}

module.exports = createTask