const List = require('../../models/list')
const Board = require('../../models/board')
const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const createList = async (req, res) => {
    try {
        const { boardId, name, position } = req.body
        const userId = req.user?.userId

        if (!boardId || !name) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Board ID and list name are required'
            })
        }

        // Check if user has access to the board
        const board = await Board.findOne({
            _id: boardId,
            $or: [
                { createdBy: userId },
                { members: { $elemMatch: { user: userId } } }
            ]
        })

        if (!board) {
            return res.status(StatusCodes.FORBIDDEN).json({
                status: false,
                message: 'Access denied to this board'
            })
        }

        // Get the highest position if not provided
        let listPosition = position
        if (listPosition === undefined) {
            const lastList = await List.findOne({ board: boardId }).sort({ position: -1 })
            listPosition = lastList ? lastList.position + 1 : 0
        }

        const newList = new List({
            name: name.trim(),
            board: boardId,
            position: listPosition
        })

        const savedList = await newList.save()

        res.status(StatusCodes.CREATED).json({
            status: true,
            message: 'List created successfully',
            data: savedList
        })

    } catch (error) {
        console.error('Error creating list:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to create list',
            error: error.message
        })
    }
}

const updateList = async (req, res) => {
    try {
        const { id } = req.params
        const { name, position, color, archived } = req.body
        const userId = req.user?.userId

        // Find list and check board access
        const list = await List.findById(id).populate('board')
        if (!list) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'List not found'
            })
        }

        const board = list.board
        const hasAccess = board.createdBy.equals(userId) ||
            board.members.some(member => member.user.equals(userId))

        if (!hasAccess) {
            return res.status(StatusCodes.FORBIDDEN).json({
                status: false,
                message: 'Access denied to this board'
            })
        }

        const updateData = {}
        if (name !== undefined) updateData.name = name.trim()
        if (position !== undefined) updateData.position = position
        if (color !== undefined) updateData.color = color
        if (archived !== undefined) updateData.archived = archived
        updateData.updatedAt = new Date()

        const updatedList = await List.findByIdAndUpdate(id, updateData, { new: true })

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'List updated successfully',
            data: updatedList
        })

    } catch (error) {
        console.error('Error updating list:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to update list',
            error: error.message
        })
    }
}

const deleteList = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.user?.userId

        // Find list and check board access
        const list = await List.findById(id).populate('board')
        if (!list) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'List not found'
            })
        }

        const board = list.board
        const hasAccess = board.createdBy.equals(userId) ||
            board.members.some(member => member.user.equals(userId) && member.role === 'admin')

        if (!hasAccess) {
            return res.status(StatusCodes.FORBIDDEN).json({
                status: false,
                message: 'Access denied - admin required'
            })
        }

        // Move tasks to archive instead of deleting
        await Task.updateMany(
            { list: id },
            {
                archived: true,
                updatedAt: new Date(),
                $push: {
                    activities: {
                        user: userId,
                        action: 'archived',
                        details: { listName: list.name },
                        timestamp: new Date()
                    }
                }
            }
        )

        // Archive the list
        await List.findByIdAndUpdate(id, { archived: true, updatedAt: new Date() })

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'List archived successfully'
        })

    } catch (error) {
        console.error('Error deleting list:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to delete list',
            error: error.message
        })
    }
}

module.exports = { createList, updateList, deleteList }