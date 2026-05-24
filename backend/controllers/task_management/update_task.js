const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const updateTask = async (req, res) => {
    try {
        const { id } = req.params
        const updateData = req.body

        // Validate status and priority if provided
        const validStatuses = ['Under-review', 'In-progress', 'Completed']
        const validPriorities = ['Low', 'Medium', 'High', 'Urgent']

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

        // Enhanced date handling with comprehensive validation
        const dateFields = ['dueDate', 'startDate']
        const processedDates = {}

        for (const dateField of dateFields) {
            if (updateData[dateField]) {
                try {
                    const dateValue = updateData[dateField]
                    const date = new Date(dateValue)

                    // Validate date is not invalid
                    if (isNaN(date.getTime())) {
                        return res.status(StatusCodes.BAD_REQUEST).json({
                            status: false,
                            message: `Invalid ${dateField} format. Please provide a valid date.`
                        })
                    }

                    processedDates[dateField] = date
                } catch (err) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: `Error parsing ${dateField}: ${err.message}`
                    })
                }
            }
        }

        // Date validation: start date must be before due date
        if (processedDates.startDate && processedDates.dueDate) {
            if (processedDates.startDate.getTime() > processedDates.dueDate.getTime()) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Start date cannot be after due date'
                })
            }
        }

        // Apply processed dates to updateData
        Object.assign(updateData, processedDates)

        // Handle taskConfig dates if provided
        if (updateData.taskConfig) {
            if (updateData.taskConfig.startDate) {
                try {
                    const configStartDate = new Date(updateData.taskConfig.startDate)
                    if (isNaN(configStartDate.getTime())) {
                        return res.status(StatusCodes.BAD_REQUEST).json({
                            status: false,
                            message: 'Invalid taskConfig.startDate format'
                        })
                    }
                    updateData.taskConfig.startDate = configStartDate
                } catch (err) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: `Error parsing taskConfig.startDate: ${err.message}`
                    })
                }
            }
        }

        // Auto-update status based on start date (only if status not explicitly provided)
        if (processedDates.startDate && !req.body.status) {
            const startDate = processedDates.startDate
            const today = new Date()

            // Compare dates at day level (ignoring time)
            const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
            const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

            // Set to In-progress if start date is today or past
            if (startDateOnly.getTime() <= todayOnly.getTime()) {
                updateData.status = 'In-progress'
            }
        }

        // Add updatedAt timestamp and activity log for date changes
        updateData.updatedAt = new Date()

        // Track which dates were changed for activity log
        const dateChanges = {}
        if (processedDates.startDate) dateChanges.startDate = processedDates.startDate.toISOString()
        if (processedDates.dueDate) dateChanges.dueDate = processedDates.dueDate.toISOString()

        const activityUpdate = {}
        if (Object.keys(dateChanges).length > 0) {
            activityUpdate.$push = {
                activities: {
                    user: req.user?.userId || 'system',
                    action: 'updated_dates',
                    details: dateChanges,
                    timestamp: new Date()
                }
            }
        }

        // Merge activity update with main update data
        const finalUpdateData = { ...updateData, ...activityUpdate }

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            finalUpdateData,
            { new: true, runValidators: true }
        )
            .populate('board', 'name')
            .populate('list', 'name')
            .populate('incharge', 'full_name email')
            .populate('members', 'full_name email')
            .populate('watchers', 'full_name email')
            .populate('createdBy', 'full_name email')
            .populate('belongs.itBelongsTo', 'full_name email')
            .populate('comments.commenter', 'full_name email')
            .populate('attachmentsFile.uploadedBy', 'full_name email')
            .populate('activities.user', 'full_name email')

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
