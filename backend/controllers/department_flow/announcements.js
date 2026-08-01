
const Announcement = require('../../models/announcement.js');
const Department = require('../../models/department.js');
const User = require('../../models/user.js');
const Notification = require('../../models/notification.js');
const { getDepartmentIdsForHead } = require('./visitors_by_status');

/**
 * POST /department-manager/announcements
 * Publish an announcement, notice, or directive to one of the managed departments.
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

        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        // Default to the first managed department when none is specified
        const targetDepartmentId = department_id || departmentIds[0];
        if (!departmentIds.includes(targetDepartmentId)) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'Access denied to this department'
            });
        }

        const department = await Department.findById(targetDepartmentId).select('name');

        const validTypes = ['Announcement', 'Notice', 'Directive'];

        const announcement = await Announcement.create({
            title: title.trim(),
            message: message.trim(),
            a_type: validTypes.includes(a_type) ? a_type : 'Announcement',
            department_id: targetDepartmentId,
            department_name: department?.name || '',
            created_by: {
                _id: req.user.userId,
                name: req.user.full_name || '',
                title: req.user.title || ''
            }
        });

        // Fan out an in-platform notification to every department member; never fail the request
        try {
            const members = await User.find({ department: targetDepartmentId }).select('_id');
            if (members.length > 0) {
                const docs = members.map(m => ({
                    user: m._id,
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
 * List announcements for the managed departments.
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

        const filter = { department_id: { $in: departmentIds }, is_active: true };

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
 * Retract an announcement belonging to one of the managed departments (soft delete).
 */
const deleteAnnouncement = async (req, res, next) => {
    try {
        const { id } = req.params;

        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const announcement = await Announcement.findById(id);
        if (!announcement || !announcement.is_active) {
            return res.status(404).json({
                success: false,
                type: 'error',
                message: 'Announcement not found'
            });
        }

        if (!departmentIds.includes(announcement.department_id)) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'Access denied to this announcement'
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
