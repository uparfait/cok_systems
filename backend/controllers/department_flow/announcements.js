
const Announcement = require('../../models/announcement.js');
const Department = require('../../models/department.js');
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
        const senderId = req.user.userId.toString();

        // Resolve the department leader(s) who must receive this publication.
        // If the destination has no head of department, tell the sender and publish nothing.
        const leaderIds = new Set();
        let targetDepartment = null;
        const departmentsWithoutLeader = [];

        if (isForAll) {
            const departments = await Department.find({}).select('name department_leader leader');
            departments.forEach(d => {
                const deptLeaders = [d.department_leader, d.leader].filter(Boolean).map(id => id.toString());
                if (deptLeaders.length === 0) {
                    departmentsWithoutLeader.push(d.name);
                } else {
                    deptLeaders.forEach(id => leaderIds.add(id));
                }
            });
            leaderIds.delete(senderId);

            if (leaderIds.size === 0) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: 'No other department heads are assigned in the system yet — there is nobody to receive this publication.'
                });
            }
        } else {
            targetDepartment = await Department.findById(department_id).select('name department_leader leader');
            if (!targetDepartment) {
                return res.status(404).json({
                    success: false,
                    type: 'error',
                    message: 'Target department not found'
                });
            }

            [targetDepartment.department_leader, targetDepartment.leader]
                .filter(Boolean)
                .forEach(id => leaderIds.add(id.toString()));
            leaderIds.delete(senderId);

            if (leaderIds.size === 0) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: `"${targetDepartment.name}" has no head of department assigned — publication not sent. Ask the administrator to assign a leader first.`
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

        // Notify the department leader(s); never fail the request at this point
        let notifiedCount = 0;
        try {
            const docs = Array.from(leaderIds).map(userId => ({
                user: userId,
                type: 'announcement',
                title: `${announcement.a_type}: ${announcement.title}`,
                message: announcement.message
            }));
            if (docs.length > 0) {
                await Notification.insertMany(docs, { ordered: false });
                notifiedCount = docs.length;
            }
        } catch (notifyError) {
            console.error('Announcement notification fan-out failed:', notifyError.message);
        }

        let successMessage = `Published — ${notifiedCount} department head${notifiedCount === 1 ? '' : 's'} notified`;
        if (isForAll && departmentsWithoutLeader.length > 0) {
            successMessage += `. Note: ${departmentsWithoutLeader.length} department${departmentsWithoutLeader.length === 1 ? ' has' : 's have'} no head assigned and could not be notified.`;
        }

        return res.status(201).json({
            success: true,
            type: 'success',
            message: successMessage,
            notified_leaders: notifiedCount,
            departments_without_leader: departmentsWithoutLeader,
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
