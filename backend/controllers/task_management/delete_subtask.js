const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const deleteChecklist = async (req, res) => {
    try {
        const { id, checklistId } = req.params

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                $pull: { checklists: { _id: checklistId } },
                updatedAt: new Date()
            },
            { new: true }
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
            message: 'Checklist deleted successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error deleting checklist:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to delete checklist',
            error: error.message
        })
    }
}

module.exports = deleteChecklist