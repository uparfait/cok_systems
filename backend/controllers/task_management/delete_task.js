const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')
const fs = require('fs')
const path = require('path')

const deleteTask = async (req, res) => {
    try {
        const { id } = req.params

        const deletedTask = await Task.findById(id)

        if (!deletedTask) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Task not found'
            })
        }

        const attachmentFiles = (deletedTask.attachmentsFile || [])
            .map(att => att.url)
            .filter(url => url && typeof url === 'string')

        await Task.findByIdAndDelete(id)

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Task deleted successfully',
            data: deletedTask
        })

        if (attachmentFiles.length > 0) {
            Promise.allSettled(
                attachmentFiles.map(filePath => {
                    const relativePath = filePath.replace(/^[/\\]+/, '')
                    const absolutePath = path.join(__dirname, '../../', relativePath)
                    return fs.promises.unlink(absolutePath).catch(() => {})
                })
            ).then(() => {
                console.log(`[deleteTask] Cleaned up ${attachmentFiles.length} attachment file(s) for task ${id}`)
            }).catch(() => {})
        }

    } catch (error) {
        console.error('Error deleting task:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to delete task',
            error: error.message
        })
    }
}

module.exports = deleteTask