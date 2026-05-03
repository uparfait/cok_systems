const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const createTask = async (req, res) => {
    try {
        let taskData;

        // Check if it's FormData (multipart) or JSON
        if (req.body.taskData) {
            // FormData request
            taskData = JSON.parse(req.body.taskData);
        } else {
            // JSON request
            taskData = req.body;
        }

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
        } = taskData

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
            }
        }

        const processedAttachments = [];

        // Handle cover image upload
        let coverImageUrl = null;
        if (req.files && req.files.coverImage && req.files.coverImage.length > 0) {
            const coverImage = req.files.coverImage[0];
            coverImageUrl = `/uploads/tasks/covers/${coverImage.filename}`;
        }

        // Handle attachments
        if (req.files && req.files.attachments) {
            const attachments = Array.isArray(req.files.attachments) ? req.files.attachments : [req.files.attachments];
            for (const file of attachments) {
                processedAttachments.push({
                    filename: file.originalname,
                    url: `/uploads/tasks/attachments/${file.filename}`,
                    description: ''
                });
            }
        }

        // Determine initial status based on dates
        let initialStatus = status
        if (status === 'Under-review' && taskConfig?.startDate) {
            const startDate = new Date(taskConfig.startDate)
            const now = new Date()
            if (startDate <= now) {
                initialStatus = 'In-progress'
            }
        }

        const newTask = new Task({
            belongs: belongs || { isBelongsTo: false },
            incharge,
            title,
            description,
            status: initialStatus,
            dueDate: new Date(dueDate),
            taskConfig: {
                ...taskConfig,
                coverImage: coverImageUrl
            },
            subtasks: subtasks.map(subtask => ({
                ...subtask,
                status: subtask.status || 'Under-review'
            })),
            attachmentsFile: processedAttachments
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