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
            board,
            list,
            incharge,
            members = [],
            watchers = [],
            title,
            description,
            status = 'To Do',
            priority = 'Medium',
            labels = [],
            dueDate,
            startDate,
            taskConfig,
            checklists = []
        } = taskData

        // Validate required fields
        if (!incharge || !title) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Incharge and title are required'
            })
        }

        // Validate checklists if provided
        if (taskData.checklists && Array.isArray(taskData.checklists)) {
            for (const checklist of taskData.checklists) {
                if (!checklist.title || checklist.title.trim() === '') {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: 'All checklists must have a title'
                    })
                }
                if (!checklist.items || !Array.isArray(checklist.items) || checklist.items.length === 0) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: 'Each checklist must have at least one item'
                    })
                }
                for (const item of checklist.items) {
                    if (!item.text || item.text.trim() === '') {
                        return res.status(StatusCodes.BAD_REQUEST).json({
                            status: false,
                            message: 'All checklist items must have text'
                        })
                    }
                }
            }
        }

        // Validate status and priority
        const validStatuses = ['Under-review', 'In-progress', 'Completed']
        const validPriorities = ['Low', 'Medium', 'High', 'Urgent']

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

        // Validate checklists if provided
        if (taskData.checklists && taskData.checklists.length > 0) {
            for (const checklist of taskData.checklists) {
                if (!checklist.title) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: 'All checklists must have a title'
                    })
                }
                if (checklist.items && checklist.items.length > 0) {
                    for (const item of checklist.items) {
                        if (!item.text) {
                            return res.status(StatusCodes.BAD_REQUEST).json({
                                status: false,
                                message: 'All checklist items must have text'
                            })
                        }
                    }
                }
            }
        }

        const processedAttachments = [];

        // Handle attachments
        if (req.files && req.files.attachments) {
            const attachments = Array.isArray(req.files.attachments) ? req.files.attachments : [req.files.attachments];
            for (const file of attachments) {
                processedAttachments.push({
                    filename: file.filename,
                    originalName: file.originalname,
                    url: `${process.env.TASK_ATTACHMENTS_URL || 'http://localhost:2026'}/uploads/tasks/attachments/${file.filename}`,
                    uploadedBy: incharge,
                    type: file.mimetype.startsWith('image/') ? 'image' : 'document'
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
            board,
            list,
            incharge,
            members,
            watchers,
            title,
            description,
            status: initialStatus,
            priority,
            labels,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            startDate: startDate ? new Date(startDate) : undefined,
            taskConfig: {
                ...taskConfig
            },
            checklists: checklists.map((checklist, index) => ({
                ...checklist,
                position: checklist.position || index,
                items: checklist.items ? checklist.items.map((item, itemIndex) => ({
                    ...item,
                    position: item.position || itemIndex
                })) : []
            })),
            attachmentsFile: processedAttachments.map(attachment => ({
                ...attachment,
                uploadedBy: incharge, // Creator is the uploader
                type: attachment.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? 'image' : 'document'
            })),
            createdBy: incharge, // Creator is the incharge
            activities: [{
                user: incharge,
                action: 'created',
                details: { title },
                timestamp: new Date()
            }]
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