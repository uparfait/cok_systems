const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const addComment = async (req, res) => {
    try {
        const { id } = req.params
        const { commenter, comment } = req.body

        if (!commenter || !comment) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Commenter and comment are required'
            })
        }

        const newComment = {
            commenter,
            comment,
            createdAt: new Date(),
            updatedAt: new Date()
        }



        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                $push: { comments: newComment },
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
            message: 'Comment added successfully',
            data: updatedTask
        })

    } catch (error) {
        console.error('Error adding comment:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to add comment',
            error: error.message
        })
    }
}

module.exports = addComment