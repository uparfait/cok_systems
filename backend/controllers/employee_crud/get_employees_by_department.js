const User = require('../../models/user.js');
const Department = require('../../models/department.js');
const mongoose = require('mongoose');

/**
 * Get employees filtered by department.
 *
 * How membership is stored on the User model:
 * - `department` (ObjectId ref) always points at the PARENT department
 * - `department_unit` (plain string id) points at the unit, when the employee
 *   belongs to one
 *
 * The given department_id can therefore be a UNIT id or a PARENT id, and
 * units are checked FIRST:
 * 1. employees whose `department_unit` equals the id (the id is a unit):
 *    when any are found, ONLY those are returned
 * 2. otherwise employees whose `department` equals the id (the id is a parent)
 * 3. last resort: users listed in the Department document's `employees` array
 */
module.exports = async function get_employees_by_department(req, res, next) {
    try {
        let {
            department_id = null,
            department_name = null,
            is_active = null,
            is_account_activated = null,
            limit = 50,
            page = 1
        } = req.query || {};

        if (!department_id && !department_name) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'Either department_id or department_name is required'
            });
        }

        const limit_val = Math.min(parseInt(limit) || 50, 200);
        const skip_val = ((parseInt(page) || 1) - 1) * limit_val;

        const activeFilters = {};
        if (is_active !== null && is_active !== undefined) {
            activeFilters.is_active = is_active === 'true' || is_active === true;
        }
        if (is_account_activated !== null && is_account_activated !== undefined) {
            activeFilters.is_account_activated = is_account_activated === 'true' || is_account_activated === true;
        }

        const fetchFor = async (baseFilter) => {
            const filter = { ...baseFilter, ...activeFilters };
            const total = await User.countDocuments(filter);
            if (total === 0) return { total: 0, employees: [] };
            const employees = await User.find(filter)
                .select('-twofa_setup -password -auth -twofa_secret')
                .limit(limit_val)
                .skip(skip_val)
                .sort({ created_date: -1 })
                .populate('department', 'department_name department_id _id')
                .populate('roles', 'role_name');
            return { total, employees };
        };

        const resolveById = async (id) => {
            const idStr = String(id);

            // 1. Units first: the id is a unit when employees carry it in
            //    their department_unit string field
            let result = await fetchFor({ department_unit: idStr });
            if (result.total > 0) return result;

            // 2. Then the parent: employees whose department points at the id
            if (mongoose.Types.ObjectId.isValid(idStr)) {
                result = await fetchFor({
                    $or: [
                        { department: new mongoose.Types.ObjectId(idStr) },
                        { department: idStr }
                    ]
                });
                if (result.total > 0) return result;
            }

            // 3. Last resort: the Department document's employees array
            const deptDoc = mongoose.Types.ObjectId.isValid(idStr)
                ? await Department.findById(idStr).select('employees')
                : null;
            const employeeIds = (deptDoc?.employees || []).map(e => e.toString());
            if (employeeIds.length > 0) {
                result = await fetchFor({ _id: { $in: employeeIds } });
            }
            return result;
        };

        let result = { total: 0, employees: [] };

        if (department_id) {
            result = await resolveById(department_id);
        } else {
            const escaped = department_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const departments = await Department.find({
                department_name: { $regex: escaped, $options: 'i' }
            }).select('_id');
            for (const dept of departments) {
                result = await resolveById(dept._id);
                if (result.total > 0) break;
            }
        }

        const deptInfo = department_id && mongoose.Types.ObjectId.isValid(department_id)
            ? await Department.findById(department_id)
                .select('department_name _id total_employees is_unit parent_department')
                .populate('leader', 'full_name email')
            : null;

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Employees retrieved successfully',
            department: deptInfo,
            total: result.total,
            page: parseInt(page) || 1,
            data: result.employees
        });

    } catch (error) {
        console.error("Error in get_employees_by_department:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving employees by department",
            error: error.message
        });
    }
};
