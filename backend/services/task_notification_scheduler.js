/**
 * Task Notification Scheduler
 * Handles automatic deadline reminders and task notifications
 */

const Task = require('../models/task')
const Notification = require('../models/notification')
const User = require('../models/user')

class TaskNotificationScheduler {
    constructor() {
        this.isRunning = false
        this.intervalId = null
    }

    start() {
        if (this.isRunning) {
            console.log('Task notification scheduler is already running')
            return
        }

        console.log('Starting task notification scheduler...')
        this.isRunning = true

        // Check every 5 minutes
        this.intervalId = setInterval(() => {
            this.checkDeadlines()
        }, 5 * 60 * 1000)

        // Initial check
        this.checkDeadlines()
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        this.isRunning = false
        console.log('Task notification scheduler stopped')
    }

    async checkDeadlines() {
        try {
            const now = new Date()
            const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
            const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

            // Find tasks due within 1 hour or 1 day
            const urgentTasks = await Task.find({
                dueDate: { $lte: oneHourFromNow },
                status: { $ne: 'Completed' }
            }).populate('incharge', 'full_name email')

            const upcomingTasks = await Task.find({
                dueDate: { $gt: oneHourFromNow, $lte: oneDayFromNow },
                status: { $ne: 'Completed' }
            }).populate('incharge', 'full_name email')

            // Process urgent tasks (due within 1 hour)
            for (const task of urgentTasks) {
                await this.createUrgentNotification(task, 'urgent')
            }

            // Process upcoming tasks (due within 1 day)
            for (const task of upcomingTasks) {
                await this.createUrgentNotification(task, 'upcoming')
            }

            console.log(`Checked ${urgentTasks.length} urgent and ${upcomingTasks.length} upcoming tasks`)

        } catch (error) {
            console.error('Error checking task deadlines:', error)
        }
    }

    async createUrgentNotification(task, type) {
        try {
            // Check if notification already exists for this task and time frame
            const existingNotification = await Notification.findOne({
                task: task._id,
                type: 'deadline_reminder',
                createdAt: {
                    $gte: new Date(Date.now() - 60 * 60 * 1000) // Within last hour
                }
            })

            if (existingNotification) {
                return // Already notified
            }

            const message = type === 'urgent'
                ? `URGENT: Task "${task.title}" is due within 1 hour!`
                : `REMINDER: Task "${task.title}" is due within 24 hours.`

            const title = type === 'urgent' ? 'Task Due Soon!' : 'Task Due Reminder'

            const notification = new Notification({
                user: task.incharge._id,
                task: task._id,
                type: 'deadline_reminder',
                title,
                message,
                scheduledFor: new Date()
            })

            await notification.save()

            // Emit real-time notification if WebSocket is available
            if (global.WebsocketIO) {
                global.WebsocketIO.to(`PRIVATE_ROOM_${task.incharge._id}`).emit('task_deadline_notification', {
                    task: task,
                    notification: notification,
                    type
                })
            }

            console.log(`Created ${type} notification for task "${task.title}"`)

        } catch (error) {
            console.error('Error creating urgent notification:', error)
        }
    }

    // Manual notification creation for user-triggered reminders
    async scheduleReminder(taskId, userId, reminderTime) {
        try {
            const task = await Task.findById(taskId)
            if (!task) {
                throw new Error('Task not found')
            }

            if (task.incharge.toString() !== userId) {
                throw new Error('Unauthorized to set reminder for this task')
            }

            const notification = new Notification({
                user: userId,
                task: taskId,
                type: 'deadline_reminder',
                title: 'Task Reminder',
                message: `Reminder: Task "${task.title}" is due on ${task.dueDate.toLocaleDateString()}`,
                scheduledFor: new Date(reminderTime)
            })

            await notification.save()

            return notification

        } catch (error) {
            console.error('Error scheduling reminder:', error)
            throw error
        }
    }
}

module.exports = new TaskNotificationScheduler()