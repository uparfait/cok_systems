const List = require('../../models/list')
const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const createList = async (req, res) => {
    try {
        const { boardId } = req.params
        const { name, color } = req.body

        if (!name || !name.trim()) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'List name is required'
            })
        }

        // Get the max position for this board
        const lastList = await List.findOne({ board: boardId })
            .sort({ position: -1 })

        const newList = new List({
            name: name.trim(),
            board: boardId,
            position: (lastList?.position || -1) + 1,
            color: color || '#838c91',
            isDefault: false,
            archived: false
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

module.exports = createList
