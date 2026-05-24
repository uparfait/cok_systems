const Board = require('../../models/board')
const List = require('../../models/list')
const { StatusCodes } = require('http-status-codes')

const createBoard = async (req, res) => {
    try {
        const {
            name,
            description,
            background,
            visibility = 'private'
        } = req.body

        if (!name || !name.trim()) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Board name is required'
            })
        }

        // Create board
        const newBoard = new Board({
            name: name.trim(),
            description: description?.trim(),
            background: background || { type: 'color', value: '#0079bf' },
            visibility,
            createdBy: req.user.userId,
            members: [{ user: req.user.userId, role: 'admin' }],
            labels: [],
            archived: false
        })

        const savedBoard = await newBoard.save()

        // Create default lists
        const defaultLists = [
            { name: 'To Do', position: 0, color: '#E2E4E6' },
            { name: 'In Progress', position: 1, color: '#4BADE0' },
            { name: 'Done', position: 2, color: '#70CCB8' }
        ]

        for (const listData of defaultLists) {
            await List.create({
                name: listData.name,
                board: savedBoard._id,
                position: listData.position,
                color: listData.color,
                isDefault: true,
                archived: false
            })
        }

        // Populate the board with its lists
        const populatedBoard = await Board.findById(savedBoard._id)
            .populate('createdBy', 'full_name email')
            .populate('members.user', 'full_name email')

        res.status(StatusCodes.CREATED).json({
            status: true,
            message: 'Board created successfully',
            data: populatedBoard
        })
    } catch (error) {
        console.error('Error creating board:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to create board',
            error: error.message
        })
    }
}

module.exports = createBoard
