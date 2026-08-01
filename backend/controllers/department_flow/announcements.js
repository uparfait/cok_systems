
const Announcement = require('../../models/announcement.js');
const Department = require('../../models/department.js');
const User = require('../../models/user.js');
const Notification = require('../../models/notification.js');
const { getDepartmentIdsForHead } = require('./visitors_by_status');

const ALL_DEPARTMENTS = 'all';

/**
 * POST /department-manager/announcements
 * Publish an announcement, notice, or directive to any department, or to all departments.
 * Only heads of department can publish; the target department's head and members can see it.
 */
const createAnnouncement = async (req, res, next) => {
    try {
        const { title, message, a_type, department_id } = req.body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'Title is required'
            });
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'Message is required'
            });
        }

        // Only heads of department may publish
        const managedIds = await getDepartmentIdsForHead(req.user.userId);
        if (managedIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const isForAll = !department_id || department_id === ALL_DEPARTMENTS;

        let targetDepartment = null;
        if (!isForAll) {
            targetDepartment = await Department.findById(department_id).select('name department_leader leader');
            if (!targetDepartment) {
                return res.status(404).json({
                    success: false,
                    type: 'error',
                    message: 'Target department not found'
                });
            }
        }

        const validTypes = ['Announcement', 'Notice', 'Directive'];

        const announcement = await Announcement.create({
            title: title.trim(),
            message: message.trim(),
            a_type: validTypes.includes(a_type) ? a_type : 'Announcement',
            department_id: isForAll ? ALL_DEPARTMENTS : department_id,
            department_name: isForAll ? 'All Departments' : (targetDepartment?.name || ''),
            created_by: {
                _id: req.user.userId,
                name: req.user.full_name || '',
                title: req.user.title || ''
            }
        });

        // Fan out in-platform notifications to the audience; never fail the request
        try {
            const recipientIds = new Set();

            if (isForAll) {
                // Everyone attached to any department, plus every department leader
                const [members, departments] = await Promise.all([
                    User.find({ department: { $ne: null } }).select('_id'),
                    Department.find({}).select('department_leader leader')
                ]);
                members.forEach(m => recipientIds.add(m._id.toString()));
                departments.forEach(d => {
                    if (d.department_leader) recipientIds.add(d.department_leader.toString());
                    if (d.leader) recipientIds.add(d.leader.toString());
                });
            } else {
                const members = await User.find({ department: department_id }).select('_id');
                members.forEach(m => recipientIds.add(m._id.toString()));
                if (targetDepartment?.department_leader) recipientIds.add(targetDepartment.department_leader.toString());
                if (targetDepartment?.leader) recipientIds.add(targetDepartment.leader.toString());
            }

            // Don't notify the sender about their own publication
            recipientIds.delete(req.user.userId.toString());

            if (recipientIds.size > 0) {
                const docs = Array.from(recipientIds).map(userId => ({
                    user: userId,
                    type: 'announcement',
                    title: `${announcement.a_type}: ${announcement.title}`,
                    message: announcement.message
                }));
                await Notification.insertMany(docs, { ordered: false });
            }
        } catch (notifyError) {
            console.error('Announcement notification fan-out failed:', notifyError.message);
        }

        return res.status(201).json({
            success: true,
            type: 'success',
            message: 'Announcement published successfully',
            data: announcement
        });

    } catch (error) {
        console.error('Error in createAnnouncement:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while publishing the announcement',
            error: error.message
        });
    }
};

/**
 * GET /department-manager/announcements
 * List announcements visible to this head of department:
 * - addressed to any of their managed departments
 * - addressed to all departments
 * - published by themselves (to any destination)
 */
const listAnnouncements = async (req, res, next) => {
    try {
        let { limit = 20, page = 1, a_type } = req.query;

        const limit_val = Math.min(parseInt(limit) || 20, 100);
        const skip_val = ((parseInt(page) || 1) - 1) * limit_val;

        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const filter = {
            is_active: true,
            $or: [
                { department_id: { $in: departmentIds } },
                { department_id: ALL_DEPARTMENTS },
                { 'created_by._id': req.user.userId }
            ]
        };

        const validTypes = ['Announcement', 'Notice', 'Directive'];
        if (a_type && validTypes.includes(a_type)) {
            filter.a_type = a_type;
        }

        const announcements = await Announcement.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_at: -1 });

        const total_count = await Announcement.countDocuments(filter);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Announcements retrieved successfully',
            total: total_count,
            page: parseInt(page) || 1,
            limit: limit_val,
            data: announcements
        });

    } catch (error) {
        console.error('Error in listAnnouncements:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving announcements',
            error: error.message
        });
    }
};

/**
 * DELETE /department-manager/announcements/:id
 * Retract an announcement (soft delete). Only the publisher can retract it.
 */
const deleteAnnouncement = async (req, res, next) => {
    try {
        const { id } = req.params;

        const announcement = await Announcement.findById(id);
        if (!announcement || !announcement.is_active) {
            return res.status(404).json({
                success: false,
                type: 'error',
                message: 'Announcement not found'
            });
        }

        if (!announcement.created_by?._id || announcement.created_by._id.toString() !== req.user.userId.toString()) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'Only the publisher can retract this announcement'
            });
        }

        announcement.is_active = false;
        await announcement.save();

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Announcement retracted successfully'
        });

    } catch (error) {
        console.error('Error in deleteAnnouncement:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retracting the announcement',
            error: error.message
        });
    }
};

module.exports = {
    createAnnouncement,
    listAnnouncements,
    deleteAnnouncement
};
