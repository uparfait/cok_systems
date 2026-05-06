const Board = require('../../models/board')
const { StatusCodes } = require('http-status-codes')

const createBoard = async (req, res) => {
    try {
        const { name, description, background, visibility, workspace, labels } = req.body
        const userId = req.user?.userId || req.body.userId // From auth middleware or direct

        if (!name) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Board name is required'
            })
        }

        // Create default lists for new board
        const defaultLists = [
            { name: 'To Do', position: 0, isDefault: true },
            { name: 'In Progress', position: 1, isDefault: true },
            { name: 'Review', position: 2, isDefault: true },
            { name: 'Done', position: 3, isDefault: true }
        ]

        const newBoard = new Board({
            name: name.trim(),
            description,
            background: background || { type: 'color', value: '#0079bf' },
            visibility: visibility || 'private',
            workspace,
            createdBy: userId,
            members: [{
                user: userId,
                role: 'admin'
            }],
            labels: labels || []
        })

        const savedBoard = await newBoard.save()

        // Create default lists
        const List = require('../../models/list')
        const createdLists = []
        for (const listData of defaultLists) {
            const list = new List({
                ...listData,
                board: savedBoard._id
            })
            const savedList = await list.save()
            createdLists.push(savedList)
        }

        res.status(StatusCodes.CREATED).json({
            status: true,
            message: 'Board created successfully',
            data: {
                board: savedBoard,
                lists: createdLists
            }
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