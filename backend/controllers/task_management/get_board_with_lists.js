const Board = require('../../models/board')
const List = require('../../models/list')
const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const getBoardWithLists = async (req, res) => {
    try {
        const { boardId } = req.params

        const board = await Board.findById(boardId)
            .populate('createdBy', 'full_name email')
            .populate('members.user', 'full_name email')
            .populate('labels')

        if (!board) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Board not found'
            })
        }

        // Get all lists for this board
        const lists = await List.find({ board: boardId, archived: false }).sort({ position: 1 })

        // Get all tasks for each list
        const listsWithTasks = await Promise.all(
            lists.map(async (list) => {
                const tasks = await Task.find({ list: list._id })
                    .populate('incharge', 'full_name email')
                    .populate('members', 'full_name email')
                    .populate('comments.commenter', 'full_name email')
                    .sort({ position: 1 })

                return {
                    ...list.toObject(),
                    tasks
                }
            })
        )

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Board retrieved successfully',
            data: {
                board,
                lists: listsWithTasks
            }
        })
    } catch (error) {
        console.error('Error getting board:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to retrieve board',
            error: error.message
        })
    }
}

module.exports = getBoardWithLists
