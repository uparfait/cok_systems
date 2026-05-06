const Board = require('../../models/board')
const { StatusCodes } = require('http-status-codes')

const getBoards = async (req, res) => {
    try {
        const userId = req.user?.userId || req.query.userId
        const { workspace, archived = false } = req.query

        const query = {
            archived,
            $or: [
                { createdBy: userId },
                { members: { $elemMatch: { user: userId } } },
                { visibility: 'public' }
            ]
        }

        if (workspace) {
            query.workspace = workspace
        }

        const boards = await Board.find(query)
            .populate('createdBy', 'full_name email')
            .populate('members.user', 'full_name email')
            .populate('workspace', 'name')
            .sort({ updatedAt: -1 })

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Boards retrieved successfully',
            data: boards
        })

    } catch (error) {
        console.error('Error getting boards:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to get boards',
            error: error.message
        })
    }
}

const getBoardById = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.user?.userId

        const board = await Board.findOne({
            _id: id,
            archived: false,
            $or: [
                { createdBy: userId },
                { members: { $elemMatch: { user: userId } } },
                { visibility: 'public' }
            ]
        })
            .populate('createdBy', 'full_name email')
            .populate('members.user', 'full_name email')
            .populate('workspace', 'name')

        if (!board) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Board not found or access denied'
            })
        }

        // Get lists and tasks for this board
        const List = require('../../models/list')
        const Task = require('../../models/task')

        const lists = await List.find({ board: id, archived: false })
            .sort({ position: 1 })

        const tasks = await Task.find({
            board: id,
            archived: false
        })
            .populate('incharge', 'full_name email')
            .populate('members', 'full_name email')
            .populate('list', 'name')
            .sort({ position: 1 })

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Board retrieved successfully',
            data: {
                board,
                lists,
                tasks
            }
        })

    } catch (error) {
        console.error('Error getting board:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to get board',
            error: error.message
        })
    }
}

module.exports = { getBoards, getBoardById }