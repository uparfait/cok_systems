const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const getTasks = async (req, res) => {
    try {
        const {
            status,
            priority,
            incharge,
            title,
            limit = 50,
            skip = 0,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            from,
            to
        } = req.query

        // Build query
        const query = {}
        if (status) {
            query.status = status
            // For completed tasks, only show current month
            if (status === 'Completed') {
                const now = new Date()
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
                query.updatedAt = { $gte: startOfMonth, $lte: endOfMonth }
            }
        }
        if (incharge) query.incharge = incharge
        if (title) {
            query.title = { $regex: title, $options: 'i' } // Case-insensitive search
        }
        if (from || to) {
            query.dueDate = {}
            if (from) query.dueDate.$gte = new Date(from)
            if (to) {
                const end = new Date(to)
                end.setHours(23, 59, 59, 999)
                query.dueDate.$lte = end
            }
        }

        // Build sort object
        const sort = {}
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1

        const tasks = await Task.find(query)
            .populate('incharge', 'full_name email')
            .populate('belongs.itBelongsTo', 'full_name email telephone')
            .populate('comments.commenter', 'full_name email')
            .populate('attachmentsFile.uploadedBy', 'full_name email')
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