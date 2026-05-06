const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const addChecklist = async (req, res) => {
    try {
        const { id } = req.params
        const { title, items = [] } = req.body

        if (!title) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Title is required for checklist'
            })
        }

        // Validate items
        if (!Array.isArray(items)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Items must be an array'
            })
        }

        for (const item of items) {
            if (!item.text || typeof item.text !== 'string') {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Each item must have a text field'
                })
            }
        }

        const newChecklist = {
            title,
            items: items.map(item => ({
                text: item.text.trim(),
                completed: item.completed || false
            })),
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                $push: { checklists: newChecklist },
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        )
            .populate('incharge', 'full_name email')
            .populate('comments.commenter', 'full_name email')
            .populate('attachmentsFile.uploadedBy', 'full_name email')

        if (!updatedTask) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task not found'
            })
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Checklist added successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error adding checklist:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to add checklist',
            error: error.message
        })
    }
}

module.exports = addChecklist