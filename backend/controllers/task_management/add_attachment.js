const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const addAttachment = async (req, res) => {
    try {
        const { id } = req.params
        const { filename, url, description } = req.body

        if (!filename || !url) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Filename and URL are required'
            })
        }

        const newAttachment = {
            filename,
            url,
            description: description || ''
        }

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                $push: { attachmentsFile: newAttachment },
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
            message: 'Attachment added successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error adding attachment:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to add attachment',
            error: error.message
        })
    }
}

module.exports = addAttachment