const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const addAttachment = async (req, res) => {
    try {
        const { id } = req.params

        const processedAttachments = []

        // Handle attachments
        if (req.files && req.files.attachments) {
            const attachments = Array.isArray(req.files.attachments) ? req.files.attachments : [req.files.attachments]
            for (const file of attachments) {
                processedAttachments.push({
                    filename: file.filename,
                    originalName: file.originalname,
                    url: `${process.env.TASK_ATTACHMENTS_URL || 'http://localhost:2026'}/uploads/tasks/attachments/${file.filename}`,
                    uploadedBy: req.user?.id || req.body.incharge, // Assuming auth middleware sets req.user
                    type: file.mimetype
                })
            }
        } else {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'No attachments provided'
            })
        }

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                $push: { attachmentsFile: { $each: processedAttachments } },
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
            message: 'Attachments added successfully',
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