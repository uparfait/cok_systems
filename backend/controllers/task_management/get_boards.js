const Board = require('../../models/board')
const { StatusCodes } = require('http-status-codes')

const getBoards = async (req, res) => {
    try {
        const { skip = 0, limit = 20 } = req.query
        const userId = req.user.userId

        // Get boards created by user or where user is a member
        const boards = await Board.find({
            $or: [
                { createdBy: userId },
                { 'members.user': userId }
            ],
            archived: false
        })
            .populate('createdBy', 'full_name email')
            .populate('members.user', 'full_name email')
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))

        const total = await Board.countDocuments({
            $or: [
                { createdBy: userId },
                { 'members.user': userId }
            ],
            archived: false
        })

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Boards retrieved successfully',
            data: {
                boards,
                pagination: {
                    total,
                    skip: parseInt(skip),
                    limit: parseInt(limit),
                    hasMore: total > parseInt(skip) + parseInt(limit)
                }
            }
        })
    } catch (error) {
        console.error('Error getting boards:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to retrieve boards',
            error: error.message
        })
    }
}

module.exports = getBoards
