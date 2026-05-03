/**
 * Task Notification Scheduler
 * Handles automatic deadline reminders and task notifications
 */

const Task = require('../models/task')
const Notification = require('../models/notification')
const User = require('../models/user')
const cron = require('node-cron')

class TaskNotificationScheduler {
    constructor() {
        this.isRunning = false
        this.intervalId = null
        this.cronJob = null
    }

    start() {
        if (this.isRunning) {
            console.log('Task notification scheduler is already running')
            return
        }

        console.log('Starting task notification scheduler...')
        this.isRunning = true

        // Check every 5 minutes using setInterval for more frequent checks
        this.intervalId = setInterval(() => {
            this.checkDeadlines()
        }, 5 * 60 * 1000)

        // Also run cron job every hour for comprehensive monitoring
        this.cronJob = cron.schedule('0 * * * *', () => {
            console.log('Running hourly task monitoring...')
            this.monitorAllTasks()
        })

        // Initial check
        this.checkDeadlines()
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        if (this.cronJob) {
            this.cronJob.stop()
            this.cronJob = null
        }
        this.isRunning = false
        console.log('Task notification scheduler stopped')
    }

    // Comprehensive task monitoring - runs hourly
    async monitorAllTasks() {
        try {
            console.log('Starting comprehensive task monitoring...')

            const now = new Date()
            const overdueTasks = await Task.find({
                dueDate: { $lt: now },
                status: { $ne: 'Completed' }
            }).populate('incharge', 'full_name email')

            const stuckTasks = await Task.find({
                status: 'In-progress',
                updatedAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } // Not updated in 7 days
            }).populate('incharge', 'full_name email')

            // Create notifications for overdue tasks
            for (const task of overdueTasks) {
                const existingNotification = await Notification.findOne({
                    task: task._id,
                    type: 'deadline_reminder',
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
                })

                if (!existingNotification) {
                    await this.createUrgentNotification(task, 'overdue')
                }
            }

            // Create notifications for stuck tasks
            for (const task of stuckTasks) {
                const existingNotification = await Notification.findOne({
                    task: task._id,
                    type: 'task_stuck',
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })

                if (!existingNotification) {
                    const notification = new Notification({
                        user: task.incharge._id,
                        task: task._id,
                        type: 'task_stuck',
                        title: 'Task May Be Stuck',
                        message: `Task "${task.title}" has been in progress for over a week without updates.`,
                        scheduledFor: new Date()
                    })
                    await notification.save()
                }
            }

            console.log(`Comprehensive monitoring: ${overdueTasks.length} overdue, ${stuckTasks.length} potentially stuck tasks`)

        } catch (error) {
            console.error('Error in comprehensive task monitoring:', error)
        }
    }

    async checkDeadlines() {
        try {
            const now = new Date()
            const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
            const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

            // Auto-transition Under-review tasks to In-progress when start date is reached
            const tasksToStart = await Task.find({
                status: 'Under-review',
                dueDate: { $lte: now }
            })

            for (const task of tasksToStart) {
                await Task.findByIdAndUpdate(task._id, { status: 'In-progress' })
                console.log(`Auto-transitioned task "${task.title}" from Under-review to In-progress`)
            }

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

            console.log(`Checked ${urgentTasks.length} urgent, ${upcomingTasks.length} upcoming tasks, and transitioned ${tasksToStart.length} tasks`)

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