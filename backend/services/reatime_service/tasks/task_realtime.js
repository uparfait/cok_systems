/**
 * Task Management Real-time Service
 * Handles WebSocket events for task updates, notifications, and live collaboration
 */

const Task = require('../../../models/task')
const Board = require('../../../models/board')
const List = require('../../../models/list')
const Notification = require('../../../models/notification')

function taskRealtime(socket) {
    // Join task-specific rooms
    socket.on('join_task_room', (taskId) => {
        socket.join(`TASK_ROOM_${taskId}`)
        console.log(`User ${socket.user?.email || socket.id} joined task room: TASK_ROOM_${taskId}`)
    })

    socket.on('leave_task_room', (taskId) => {
        socket.leave(`TASK_ROOM_${taskId}`)
        console.log(`User ${socket.user?.email || socket.id} left task room: TASK_ROOM_${taskId}`)
    })

    // Task status updates
    socket.on('update_task_status', async (data) => {
        try {
            const { taskId, status, userId } = data

            if (!socket.user || socket.user.userId !== userId) {
                socket.emit('task_error', { message: 'Unauthorized' })
                return
            }

            // Update task status
            const updatedTask = await Task.findByIdAndUpdate(
                taskId,
                { status, updatedAt: new Date() },
                { new: true }
            ).populate('incharge', 'full_name email')

            if (!updatedTask) {
                socket.emit('task_error', { message: 'Task not found' })
                return
            }

            // Emit to task room
            socket.to(`TASK_ROOM_${taskId}`).emit('task_status_updated', {
                taskId,
                status,
                updatedBy: socket.user,
                timestamp: new Date()
            })

            // Emit to user's private room for notifications
            const notifyUsers = [updatedTask.incharge, ...updatedTask.members, ...updatedTask.watchers]
                .filter((user, index, arr) => arr.indexOf(user) === index) // Remove duplicates

            notifyUsers.forEach(userId => {
                socket.to(`PRIVATE_ROOM_${userId}`).emit('task_updated', {
                    task: updatedTask,
                    action: 'status_changed',
                    newStatus: status
                })
            })

        } catch (error) {
            console.error('Error updating task status:', error)
            socket.emit('task_error', { message: 'Failed to update task status' })
        }
    })

    // Subtask updates
    socket.on('update_checklist_item', async (data) => {
        try {
            const { taskId, checklistId, updates, userId } = data

            if (!socket.user || socket.user.userId !== userId) {
                socket.emit('task_error', { message: 'Unauthorized' })
                return
            }

            // Update checklist item
            const { itemIndex, completed } = updates
            const updateQuery = {}
            if (typeof itemIndex === 'number' && typeof completed === 'boolean') {
                updateQuery[`checklists.$.items.${itemIndex}.completed`] = completed
                updateQuery[`checklists.$.updatedAt`] = new Date()
            }

            const updatedTask = await Task.findOneAndUpdate(
                { _id: taskId, 'checklists._id': checklistId },
                { $set: updateQuery, updatedAt: new Date() },
                { new: true }
            ).populate('incharge', 'full_name email')

            if (!updatedTask) {
                socket.emit('task_error', { message: 'Task or subtask not found' })
                return
            }

            // Emit to task room
            socket.to(`TASK_ROOM_${taskId}`).emit('subtask_updated', {
                taskId,
                subtaskId,
                updates,
                updatedBy: socket.user,
                timestamp: new Date()
            })

        } catch (error) {
            console.error('Error updating subtask:', error)
            socket.emit('task_error', { message: 'Failed to update subtask' })
        }
    })

    // Add comment
    socket.on('add_comment', async (data) => {
        try {
            const { taskId, comment, userId } = data

            if (!socket.user || socket.user.userId !== userId) {
                socket.emit('task_error', { message: 'Unauthorized' })
                return
            }

            const newComment = {
                commenter: userId,
                comment,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            const updatedTask = await Task.findByIdAndUpdate(
                taskId,
                {
                    $push: { comments: newComment },
                    updatedAt: new Date()
                },
                { new: true }
            ).populate('comments.commenter', 'full_name email')

            if (!updatedTask) {
                socket.emit('task_error', { message: 'Task not found' })
                return
            }

            // Emit to task room
            socket.to(`TASK_ROOM_${taskId}`).emit('comment_added', {
                taskId,
                comment: newComment,
                commenter: socket.user,
                timestamp: new Date()
            })

        } catch (error) {
            console.error('Error adding comment:', error)
            socket.emit('task_error', { message: 'Failed to add comment' })
        }
    })

    // Task deadline reminders
    socket.on('schedule_deadline_reminder', async (data) => {
        try {
            const { taskId, reminderTime, userId } = data

            if (!socket.user || socket.user.userId !== userId) {
                socket.emit('task_error', { message: 'Unauthorized' })
                return
            }

            const task = await Task.findById(taskId)
            if (!task) {
                socket.emit('task_error', { message: 'Task not found' })
                return
            }

            // Create notification
            const notification = new Notification({
                user: userId,
                task: taskId,
                type: 'deadline_reminder',
                title: 'Task Deadline Reminder',
                message: `Task "${task.title}" is due on ${task.dueDate.toLocaleDateString()}`,
                scheduledFor: new Date(reminderTime)
            })

            await notification.save()

            socket.emit('reminder_scheduled', {
                taskId,
                reminderTime,
                notificationId: notification._id
            })

        } catch (error) {
            console.error('Error scheduling reminder:', error)
            socket.emit('task_error', { message: 'Failed to schedule reminder' })
        }
    })

    // Get active tasks for user
    socket.on('get_active_tasks', async (data) => {
        try {
            const { userId } = data

            if (!socket.user || socket.user.userId !== userId) {
                socket.emit('task_error', { message: 'Unauthorized' })
                return
            }

            const activeTasks = await Task.find({
                $or: [{ incharge: userId }, { members: userId }],
                status: { $in: ['Under-review', 'In-progress'] },
                archived: false
            }).sort({ dueDate: 1 })

            socket.emit('active_tasks', { tasks: activeTasks })

        } catch (error) {
            console.error('Error getting active tasks:', error)
            socket.emit('task_error', { message: 'Failed to get active tasks' })
        }
    })

    // Board room management
    socket.on('join_board_room', (boardId) => {
        socket.join(`BOARD_ROOM_${boardId}`)
        console.log(`User ${socket.user?.email || socket.id} joined board room: BOARD_ROOM_${boardId}`)
    })

    socket.on('leave_board_room', (boardId) => {
        socket.leave(`BOARD_ROOM_${boardId}`)
        console.log(`User ${socket.user?.email || socket.id} left board room: BOARD_ROOM_${boardId}`)
    })

    // Move task between lists
    socket.on('move_task', async (data) => {
        try {
            const { taskId, fromListId, toListId, newPosition, userId } = data

            if (!socket.user || socket.user.userId !== userId) {
                socket.emit('task_error', { message: 'Unauthorized' })
                return
            }

            // Update task position and list
            const updateData = {
                list: toListId,
                position: newPosition,
                updatedAt: new Date(),
                $push: {
                    activities: {
                        user: userId,
                        action: 'moved',
                        details: { fromList: fromListId, toList: toListId },
                        timestamp: new Date()
                    }
                }
            }

            const updatedTask = await Task.findByIdAndUpdate(taskId, updateData, { new: true })
                .populate('incharge', 'full_name email')
                .populate('list', 'name')

            if (!updatedTask) {
                socket.emit('task_error', { message: 'Task not found' })
                return
            }

            // Emit to board room
            socket.to(`BOARD_ROOM_${updatedTask.board}`).emit('task_moved', {
                taskId,
                fromListId,
                toListId,
                newPosition,
                updatedTask,
                movedBy: socket.user,
                timestamp: new Date()
            })

        } catch (error) {
            console.error('Error moving task:', error)
            socket.emit('task_error', { message: 'Failed to move task' })
        }
    })

    // Update checklist item
    socket.on('update_checklist_item', async (data) => {
        try {
            const { taskId, checklistId, itemId, updates, userId } = data

            if (!socket.user || socket.user.userId !== userId) {
                socket.emit('task_error', { message: 'Unauthorized' })
                return
            }

            const updateQuery = {}
            Object.keys(updates).forEach(key => {
                updateQuery[`checklists.$[checklist].items.$[item].${key}`] = updates[key]
            })

            const updatedTask = await Task.findOneAndUpdate(
                {
                    _id: taskId,
                    'checklists._id': checklistId,
                    'checklists.items._id': itemId
                },
                {
                    $set: updateQuery,
                    updatedAt: new Date()
                },
                {
                    new: true,
                    arrayFilters: [
                        { 'checklist._id': checklistId },
                        { 'item._id': itemId }
                    ]
                }
            ).populate('incharge', 'full_name email')

            if (!updatedTask) {
                socket.emit('task_error', { message: 'Task or checklist item not found' })
                return
            }

            // Emit to task room
            socket.to(`TASK_ROOM_${taskId}`).emit('checklist_item_updated', {
                taskId,
                checklistId,
                itemId,
                updates,
                updatedBy: socket.user,
                timestamp: new Date()
            })

        } catch (error) {
            console.error('Error updating checklist item:', error)
            socket.emit('task_error', { message: 'Failed to update checklist item' })
        }
    })
}

module.exports = taskRealtime