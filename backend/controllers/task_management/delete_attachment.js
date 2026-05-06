const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const deleteAttachment = async (req, res) => {
    try {
        const { id, attachmentId } = req.params

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                $pull: { attachmentsFile: { _id: attachmentId } },
                updatedAt: new Date()
            },
            { new: true }
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
            message: 'Attachment deleted successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error deleting attachment:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to delete attachment',
            error: error.message
        })
    }
}

module.exports = deleteAttachment