const Task = require('../../models/task')
const { StatusCodes } = require('http-status-codes')

const getEmployeePerformance = async (req, res) => {
    try {
        const { startDate, endDate, userId } = req.query
        const employeeId = userId || req.user.userId

        if (!employeeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'User ID is required'
            })
        }

        // Default to current week if no date range provided
        let dateFilter = {}
        if (startDate || endDate) {
            dateFilter = {
                createdAt: {}
            }
            if (startDate) {
                dateFilter.createdAt.$gte = new Date(startDate)
            }
            if (endDate) {
                // Add 1 day to include the entire end date
                const endDateObj = new Date(endDate)
                endDateObj.setDate(endDateObj.getDate() + 1)
                dateFilter.createdAt.$lt = endDateObj
            }
        } else {
            // Default: current week (Monday to Sunday)
            const today = new Date()
            const currentDay = today.getDay()
            const firstDay = new Date(today)
            firstDay.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1))
            firstDay.setHours(0, 0, 0, 0)

            const lastDay = new Date(firstDay)
            lastDay.setDate(firstDay.getDate() + 6)
            lastDay.setHours(23, 59, 59, 999)

            dateFilter = {
                createdAt: {
                    $gte: firstDay,
                    $lte: lastDay
                }
            }
        }

        // Get all tasks for this employee in the date range
        const tasks = await Task.find({
            incharge: employeeId,
            ...dateFilter
        })
            .populate('incharge', 'full_name email')
            .sort({ createdAt: -1 })

        // Calculate metrics based on actualDateCompleted
        const metrics = calculatePerformanceMetrics(tasks)

        // Get weekly breakdown
        const weeklyData = getWeeklyBreakdown(tasks)

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Performance metrics retrieved successfully',
            data: {
                metrics,
                weeklyData,
                tasks: tasks.length,
                dateRange: {
                    startDate: dateFilter.createdAt?.$gte || new Date(),
                    endDate: dateFilter.createdAt?.$lte || new Date()
                }
            }
        })
    } catch (error) {
        console.error('Error fetching performance data:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to fetch performance data',
            error: error.message
        })
    }
}

const calculatePerformanceMetrics = (tasks) => {
    if (!tasks || tasks.length === 0) {
        return {
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            underReviewTasks: 0,
            completionRate: 0,
            averageCompletionTime: 0,
            completedToday: 0,
            onTimeRate: 0,
            overdueTasks: 0,
            onTimeTasks: 0
        }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let completedCount = 0
    let inProgressCount = 0
    let underReviewCount = 0
    let totalCompletionTime = 0
    let completedTodayCount = 0
    let overdueCount = 0
    let onTimeCount = 0

    tasks.forEach(task => {
        // Count by status
        if (task.status === 'Completed') {
            completedCount++

            // Calculate completion time using actualDateCompleted and startDate
            if (task.startDate && task.actualDateCompleted) {
                const completionTimeMs = task.actualDateCompleted - task.startDate
                const completionTimeMinutes = Math.max(0, completionTimeMs / (1000 * 60))
                totalCompletionTime += completionTimeMinutes
            }

            // Check if completed today using actualDateCompleted
            if (task.actualDateCompleted) {
                const completedDate = new Date(task.actualDateCompleted)
                completedDate.setHours(0, 0, 0, 0)
                if (completedDate.getTime() === today.getTime()) {
                    completedTodayCount++
                }
            }

            // Check if on time using actualDateCompleted vs dueDate
            if (task.dueDate && task.actualDateCompleted) {
                if (task.actualDateCompleted.getTime() <= task.dueDate.getTime()) {
                    onTimeCount++
                } else {
                    overdueCount++
                }
            } else if (task.dueDate) {
                // No actual completion, check against due date
                if (task.dueDate > now) {
                    onTimeCount++
                } else {
                    overdueCount++
                }
            } else {
                // No due date, count as on time
                onTimeCount++
            }
        } else if (task.status === 'In-progress') {
            inProgressCount++

            // Check for overdue
            if (task.dueDate && task.dueDate < now) {
                overdueCount++
            }
        } else if (task.status === 'Under-review') {
            underReviewCount++
        }
    })

    const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
    const averageCompletionTime = completedCount > 0 ? Math.round(totalCompletionTime / completedCount) : 0
    const onTimeRate = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 0

    return {
        totalTasks: tasks.length,
        completedTasks: completedCount,
        inProgressTasks: inProgressCount,
        underReviewTasks: underReviewCount,
        completionRate,
        averageCompletionTime,
        completedToday: completedTodayCount,
        onTimeRate,
        overdueTasks: overdueCount,
        onTimeTasks: onTimeCount
    }
}

const getWeeklyBreakdown = (tasks) => {
    const weeklyData = {}

    // Initialize 7 days
    for (let i = 0; i < 7; i++) {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        const dateKey = date.toISOString().split('T')[0]
        weeklyData[dateKey] = {
            date: dateKey,
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            completedTasks: 0,
            inProgressTasks: 0,
            underReviewTasks: 0,
            totalTasks: 0,
            onTimeTasks: 0,
            totalCompletionTimeMinutes: 0
        }
    }

    // Populate with task data
    tasks.forEach(task => {
        const dateKey = task.createdAt.toISOString().split('T')[0]
        if (weeklyData[dateKey]) {
            if (task.status === 'Completed') {
                weeklyData[dateKey].completedTasks++

                // Track on-time completion for the day
                if (task.dueDate && task.actualDateCompleted) {
                    if (task.actualDateCompleted.getTime() <= task.dueDate.getTime()) {
                        weeklyData[dateKey].onTimeTasks++
                    }
                    // Add to completion time
                    const completionTimeMs = task.actualDateCompleted - task.startDate
                    if (completionTimeMs > 0) {
                        weeklyData[dateKey].totalCompletionTimeMinutes += completionTimeMs / (1000 * 60)
                    }
                }
            } else if (task.status === 'In-progress') {
                weeklyData[dateKey].inProgressTasks++
            } else if (task.status === 'Under-review') {
                weeklyData[dateKey].underReviewTasks++
            }
            weeklyData[dateKey].totalTasks++
        }
    })

    return Object.values(weeklyData)
}

module.exports = getEmployeePerformance
