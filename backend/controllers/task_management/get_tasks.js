const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const getTasks = async (req, res) => {
    try {
        const {
            status,
            priority,
            incharge,
            limit = 50,
            skip = 0,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query

        // Build query
        const query = {}
        if (status) query.status = status
        if (priority) query.priority = priority
        if (incharge) query.incharge = incharge

        // Build sort object
        const sort = {}
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1

        const tasks = await Task.find(query)
            .populate('incharge', 'full_name email')
            .populate('belongs.itBelongsTo', 'full_name email')
            .populate('comments.commenter', 'full_name email')
            .sort(sort)
            .limit(parseInt(limit))
            .skip(parseInt(skip))

        const total = await Task.countDocuments(query)

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Tasks retrieved successfully',
            data: {
                tasks,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: total > parseInt(skip) + parseInt(limit)
                }
            }
        })

    } catch (error) {
        console.error('Error getting tasks:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to retrieve tasks',
            error: error.message
        })
    }
}

module.exports = getTasks