const Task = require('../../models/task')
const User = require('../../models/user')
const { StatusCodes } = require('http-status-codes')

const getTeamPerformance = async (req, res) => {
    try {
        const { departmentId, startDate, endDate, managerId } = req.query
        const managerUserId = managerId || req.user.userId

        if (!managerUserId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Manager ID is required'
            })
        }

        // Get department members if departmentId is provided
        let memberIds = []
        if (departmentId) {
            const members = await User.find({ department: departmentId }, '_id')
            memberIds = members.map(m => m._id)
        } else {
            // Get all members managed by this user (if manager)
            const manager = await User.findById(managerUserId).populate('department')
            if (manager?.department) {
                const deptMembers = await User.find({ department: manager.department._id }, '_id')
                memberIds = deptMembers.map(m => m._id)
            }
        }

        if (memberIds.length === 0) {
            return res.status(StatusCodes.OK).json({
                status: true,
                message: 'No team members found',
                data: {
                    teamMetrics: [],
                    overallMetrics: calculatePerformanceMetrics([]),
                    weeklyData: getWeeklyBreakdown([])
                }
            })
        }

        // Build date filter (current week by default)
        let dateFilter = {}
        if (startDate || endDate) {
            dateFilter = {
                createdAt: {}
            }
            if (startDate) {
                dateFilter.createdAt.$gte = new Date(startDate)
            }
            if (endDate) {
                const endDateObj = new Date(endDate)
                endDateObj.setDate(endDateObj.getDate() + 1)
                dateFilter.createdAt.$lt = endDateObj
            }
        } else {
            // Current week
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

        // Get all tasks for team members
        const allTasks = await Task.find({
            incharge: { $in: memberIds },
            ...dateFilter
        })
            .populate('incharge', 'full_name email')
            .sort({ createdAt: -1 })

        // Get metrics per team member
        const teamMetrics = {}
        memberIds.forEach(memberId => {
            const memberTasks = allTasks.filter(t => t.incharge._id.toString() === memberId.toString())
            teamMetrics[memberId] = calculatePerformanceMetrics(memberTasks)
            teamMetrics[memberId].memberInfo = memberTasks[0]?.incharge || {}
        })

        // Overall team metrics
        const overallMetrics = calculatePerformanceMetrics(allTasks)

        // Weekly breakdown
        const weeklyData = getWeeklyBreakdown(allTasks)

        res.status(StatusCodes.OK).json({
            status: true,
            message: 'Team performance metrics retrieved successfully',
            data: {
                teamMetrics: Object.entries(teamMetrics).map(([memberId, metrics]) => ({
                    memberId,
                    ...metrics
                })),
                overallMetrics,
                weeklyData,
                teamSize: memberIds.length
            }
        })
    } catch (error) {
        console.error('Error fetching team performance:', error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Failed to fetch team performance',
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
        if (task.status === 'Completed') {
            completedCount++

            if (task.startDate && task.actualDateCompleted) {
                const completionTimeMs = task.actualDateCompleted - task.startDate
                const completionTimeMinutes = Math.max(0, completionTimeMs / (1000 * 60))
                totalCompletionTime += completionTimeMinutes
            }

            if (task.actualDateCompleted) {
                const completedDate = new Date(task.actualDateCompleted)
                completedDate.setHours(0, 0, 0, 0)
                if (completedDate.getTime() === today.getTime()) {
                    completedTodayCount++
                }
            }

            if (task.dueDate && task.actualDateCompleted) {
                if (task.actualDateCompleted.getTime() <= task.dueDate.getTime()) {
                    onTimeCount++
                } else {
                    overdueCount++
                }
            } else if (task.dueDate) {
                if (task.dueDate > now) {
                    onTimeCount++
                } else {
                    overdueCount++
                }
            } else {
                onTimeCount++
            }
        } else if (task.status === 'In-progress') {
            inProgressCount++
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

    tasks.forEach(task => {
        const dateKey = task.createdAt.toISOString().split('T')[0]
        if (weeklyData[dateKey]) {
            if (task.status === 'Completed') {
                weeklyData[dateKey].completedTasks++

                if (task.dueDate && task.actualDateCompleted) {
                    if (task.actualDateCompleted.getTime() <= task.dueDate.getTime()) {
                        weeklyData[dateKey].onTimeTasks++
                    }
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

module.exports = getTeamPerformance
