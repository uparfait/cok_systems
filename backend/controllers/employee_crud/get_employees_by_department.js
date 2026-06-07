const User = require('../../models/user.js');
const Department = require('../../models/department.js');
const mongoose = require('mongoose');

/**
 * Get employees filtered by department
 * Uses the Department document's `employees` array (ObjectId refs) as the primary
 * data source, falling back to the User's `department` field for flexibility.
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

        const limit_val = Math.min(parseInt(limit), 200);
        const skip_val = (parseInt(page) - 1) * limit_val;
        let department_ids = [];

        // ── 1. Resolve the department(s) to query ──
        if (department_id) {
            department_ids.push(department_id);
            // Also include sub-departments (units)
            const subDepts = await Department.find({ 
                is_unit: true, 
                parent_department: department_id 
            }).select('_id');
            subDepts.forEach(sd => department_ids.push(sd._id.toString()));
        } else if (department_name) {
            const departments = await Department.find({
                $or: [
                    { name: department_name },
                    { name: { $regex: department_name, $options: 'i' } }
                ]
            });
            departments.forEach(d => department_ids.push(d._id.toString()));
        }

        // ── 2. Debug: check what's actually in the department ──
        const deptDoc = await Department.findById(department_id).select('employees total_employees name');
        console.log(`[get_employees_by_department] Dept "${deptDoc?.name}" (${department_id}):`);
        console.log(`  - total_employees counter: ${deptDoc?.total_employees}`);
        console.log(`  - employees array length: ${deptDoc?.employees?.length || 0}`);
        if (deptDoc?.employees?.length > 0) {
            console.log(`  - employees IDs: ${deptDoc.employees.map(e => e.toString()).join(', ')}`);
        }

        // ── 3. Build the user query ──
        const filter = { $or: [] };

        // Strategy A: Users whose `department` field references one of our department IDs
        // Mongoose will auto-cast strings to ObjectId for Schema.Types.ObjectId fields
        for (const deptId of department_ids) {
            if (mongoose.Types.ObjectId.isValid(deptId)) {
                filter.$or.push({ department: new mongoose.Types.ObjectId(deptId) });
                filter.$or.push({ department_unit: deptId });
            }
        }

        // Strategy B: Users whose _id is in the department's `employees` array
        const depts = await Department.find({ _id: { $in: department_ids } }).select('employees');
        const allEmployeeIds = depts.reduce((acc, d) => {
            if (d.employees && d.employees.length > 0) {
                acc.push(...d.employees.map(e => e.toString()));
            }
            return acc;
        }, []);

        if (allEmployeeIds.length > 0) {
            filter.$or.push({ _id: { $in: allEmployeeIds } });
        }

        // Also check: any User whose department string field happens to contain the ID
        // (in case the department was stored as plain string rather than ObjectId)
        for (const deptId of department_ids) {
            filter.$or.push({ department: deptId }); // plain string match
        }

        // ── 3b. Fallback: if the department claims to have employees but our queries found no one,
        // do a broad search — try ANY user who has ANY department reference that matches
        // This handles data where the department_id was stored differently than expected
        let needsFallback = false;
        if (deptDoc && deptDoc.total_employees > 0 && deptDoc.employees?.length === 0) {
            // The department has a non-zero total_employees counter but an empty employees array
            // This happens because create_employee increments total_employees without pushing to employees[]
            needsFallback = true;
            console.log(`[get_employees_by_department] total_employees=${deptDoc.total_employees} but employees[] empty. Using broad fallback.`);
        }

        // Apply optional active filters
        if (is_active !== null && is_active !== undefined) {
            filter.is_active = is_active === 'true' || is_active === true;
        }
        if (is_account_activated !== null && is_account_activated !== undefined) {
            filter.is_account_activated = is_account_activated === 'true' || is_account_activated === true;
        }

        // Debug log the query
        console.log(`[get_employees_by_department] Query filter (condensed):`, JSON.stringify({
            $or: filter.$or.map(o => Object.keys(o)),
            ...(filter.is_active !== undefined ? { is_active: filter.is_active } : {}),
            ...(filter.is_account_activated !== undefined ? { is_account_activated: filter.is_account_activated } : {})
        }));

        // ── 4. Execute query ──
        let employees = await User.find(filter)
            .select('-password -auth')
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 })
            .populate('department', 'name department_id _id')
            .populate('roles', 'role_name');

        let total_count = await User.countDocuments(filter);
        console.log(`[get_employees_by_department] Found ${total_count} users`);

        // ── 4b. Fallback query: if total_employees > 0 but query returned 0, 
        // search ALL users and filter by populated department
        if (total_count === 0 && needsFallback) {
            console.log(`[get_employees_by_department] Trying fallback: fetch ALL users and check their populated department`);
            
            // Remove the $or filter entirely and just get all users, then we'll populate and filter
            const allUsers = await User.find({})
                .select('-password -auth')
                .limit(200)
                .sort({ created_date: -1 })
                .populate('department', 'name _id')
                .populate('roles', 'role_name');
            
            // Filter by department ID or name match
            const deptName = deptDoc?.name || '';
            const deptIdStr = department_id?.toString();
            const matched = allUsers.filter(u => {
                const d = u.department;
                if (!d) return false;
                const dId = typeof d === 'object' ? (d._id?.toString() || '') : d.toString();
                const dName = typeof d === 'object' ? (d.name || '') : '';
                return dId === deptIdStr || dName === deptName || dName.toLowerCase().includes(deptName.toLowerCase());
            });
            
            if (matched.length > 0) {
                console.log(`[get_employees_by_department] Fallback found ${matched.length} users!`);
                employees = matched.slice(skip_val, skip_val + limit_val);
                total_count = matched.length;
            }
        }

        // ── 5. Return result ──
        const deptInfo = await Department.findById(department_id)
            .select('name _id total_employees')
            .populate('leader', 'full_name email');

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Employees retrieved successfully',
            department: deptInfo,
            total: total_count,
            page: parseInt(page),
            data: employees
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