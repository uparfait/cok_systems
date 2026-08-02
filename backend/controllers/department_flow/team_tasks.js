
const Task = require('../../models/task.js');
const User = require('../../models/user.js');
const Notification = require('../../models/notification.js');
const { getDepartmentIdsForHead } = require('./visitors_by_status');

// Resolve the ids of users belonging to the departments this head manages
const getTeamMemberIds = async (userId) => {
    const departmentIds = await getDepartmentIdsForHead(userId);
    if (departmentIds.length === 0) return { departmentIds: [], memberIds: [] };

    const members = await User.find({ department: { $in: departmentIds } }).select('_id');
    return { departmentIds, memberIds: members.map(m => m._id) };
};

/**
 * GET /department-manager/team-tasks
 * List tasks assigned to members of the managed departments, with status summary.
 */
const getTeamTasks = async (req, res, next) => {
    try {
        let { limit = 20, page = 1, status, memberId } = req.query;

        const limit_val = Math.min(parseInt(limit) || 20, 100);
        const skip_val = ((parseInt(page) || 1) - 1) * limit_val;

        const { memberIds } = await getTeamMemberIds(req.user.userId);
        if (memberIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const filter = { incharge: { $in: memberIds } };

        const validStatuses = ['Under-review', 'In-progress', 'Completed'];
        if (status && validStatuses.includes(status)) {
            filter.status = status;
        }

        if (memberId && memberIds.some(id => id.toString() === memberId)) {
            filter.incharge = memberId;
        }

        const tasks = await Task.find(filter)
            .populate('incharge', 'full_name email title')
            .populate('createdBy', 'full_name email')
            .select('-activities -comments -attachmentsFile')
            .limit(limit_val)
            .skip(skip_val)
            .sort({ _id: -1 });

        const total_count = await Task.countDocuments(filter);

        // Status summary across the whole team (ignores pagination/status filter)
        const summaryAgg = await Task.aggregate([
            { $match: { incharge: { $in: memberIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const summary = { 'Under-review': 0, 'In-progress': 0, 'Completed': 0, total: 0 };
        summaryAgg.forEach(s => {
            if (summary[s._id] !== undefined) summary[s._id] = s.count;
            summary.total += s.count;
        });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Team tasks retrieved successfully',
            total: total_count,
            page: parseInt(page) || 1,
            limit: limit_val,
            summary,
            data: tasks
        });

    } catch (error) {
        console.error('Error in getTeamTasks:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving team tasks',
            error: error.message
        });
    }
};

/**
 * POST /department-manager/team-tasks
 * Assign a task to a member of the managed departments.
 */
const createTeamTask = async (req, res, next) => {
    try {
        const { title, description, incharge, priority, dueDate, startDate } = req.body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'Task title is required'
            });
        }

        if (!incharge) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'An assignee (incharge) is required'
            });
        }

        const { memberIds } = await getTeamMemberIds(req.user.userId);
        if (memberIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        if (!memberIds.some(id => id.toString() === incharge)) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'The selected assignee is not a member of your department'
            });
        }

        const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];

        const task = await Task.create({
            title: title.trim(),
            description: description || '',
            incharge,
            priority: validPriorities.includes(priority) ? priority : 'Medium',
            dueDate: dueDate ? new Date(dueDate) : undefined,
            startDate: startDate ? new Date(startDate) : undefined,
            createdBy: req.user.userId,
            activities: [{
                user: req.user.userId,
                action: 'created',
                details: { note: `Task assigned by ${req.user.full_name || 'head of department'}` }
            }]
        });

        // Notify the assignee inside the platform; failure here must not fail the request
        try {
            await Notification.create({
                user: incharge,
                task: task._id,
                type: 'task_assigned',
                title: 'New task assigned',
                message: `${req.user.full_name || 'Your head of department'} assigned you the task "${task.title}"`
            });
        } catch (notifyError) {
            console.error('Task assignment notification failed:', notifyError.message);
        }

        const populated = await Task.findById(task._id)
            .populate('incharge', 'full_name email title')
            .populate('createdBy', 'full_name email');

        return res.status(201).json({
            success: true,
            type: 'success',
            message: 'Task assigned successfully',
            data: populated
        });

    } catch (error) {
        console.error('Error in createTeamTask:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while assigning the task',
            error: error.message
        });
    }
};

module.exports = {
    getTeamTasks,
    createTeamTask,
    getTeamMemberIds
};
